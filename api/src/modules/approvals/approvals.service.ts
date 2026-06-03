import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeesService } from '../fees/fees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../../common/enums/roles.enum';
import {
  AdjustmentApproval,
  ApprovalAction,
  ApprovalStatus,
} from './entities/adjustment-approval.entity';

export interface ApprovalCaller {
  userId: string;
  email: string | null;
  role: string;
  tenantId: string;
}

const APPROVERS = [Role.ADMIN, Role.SUPER_ADMIN] as string[];

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(AdjustmentApproval)
    private readonly repo: Repository<AdjustmentApproval>,
    private readonly fees: FeesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Apply immediately when the caller is a tenant/super admin, otherwise
   * queue the concession for a tenant admin to approve.
   */
  async gate(
    caller: ApprovalCaller,
    action: ApprovalAction,
    branch: string | null,
    payload: Record<string, any>,
    summary: string,
  ): Promise<unknown> {
    if (APPROVERS.includes(caller.role)) {
      return this.run(action, payload);
    }
    const saved = await this.repo.save(
      this.repo.create({
        tenantId: caller.tenantId,
        branch,
        action,
        status: ApprovalStatus.PENDING,
        summary,
        payload,
        requestedById: caller.userId,
        requestedByEmail: caller.email,
        requestedByRole: caller.role,
      }),
    );
    await this.notifications
      .send(
        caller.tenantId,
        {
          title: 'Approval needed',
          body: summary,
          type: 'approval',
          recipientRole: Role.ADMIN,
          linkUrl: '/approvals',
        },
        caller.userId,
      )
      .catch(() => undefined);
    return {
      status: 'pending',
      approvalId: saved.id,
      message:
        'Sent to a tenant admin for approval. It will apply once approved.',
    };
  }

  /** Executes the stored concession via FeesService. */
  private run(action: ApprovalAction, p: Record<string, any>): Promise<unknown> {
    switch (action) {
      case ApprovalAction.DISCOUNT_ADD_BULK:
        return this.fees.addDiscountForStudents(p.tenantId, p.dto, p.actor);
      case ApprovalAction.DISCOUNT_WAIVE_BULK:
        return this.fees.waiveDiscountForStudents(p.tenantId, p.dto, p.actor);
      case ApprovalAction.PENALTY_WAIVE_BULK:
        return this.fees.waivePenaltyForStudents(p.tenantId, p.dto, p.actor);
      case ApprovalAction.DISCOUNT_ADD_SINGLE:
        return this.fees.addDiscount(
          p.tenantId,
          p.feeId,
          p.amount,
          p.reason,
          p.actor,
        );
      case ApprovalAction.DISCOUNT_WAIVE_SINGLE:
        return this.fees.waiveDiscountOnFee(
          p.tenantId,
          p.feeId,
          p.amount,
          p.reason,
          p.actor,
        );
      case ApprovalAction.PENALTY_WAIVE_SINGLE:
        return this.fees.waivePenaltyOnFee(
          p.tenantId,
          p.feeId,
          p.amount,
          p.reason,
          p.actor,
        );
      default:
        throw new BadRequestException(`Unknown approval action: ${action}`);
    }
  }

  list(
    tenantId: string,
    status?: ApprovalStatus,
  ): Promise<AdjustmentApproval[]> {
    return this.repo.find({
      where: status ? { tenantId, status } : { tenantId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async findOne(tenantId: string, id: string): Promise<AdjustmentApproval> {
    const a = await this.repo.findOne({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Approval request not found');
    return a;
  }

  async approve(
    caller: ApprovalCaller,
    id: string,
    note?: string,
  ): Promise<AdjustmentApproval> {
    if (!APPROVERS.includes(caller.role)) {
      throw new ForbiddenException('Only a tenant admin can approve.');
    }
    const a = await this.findOne(caller.tenantId, id);
    if (a.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Already ${a.status.toLowerCase()}.`);
    }
    let result: Record<string, any> | null = null;
    try {
      result = { ok: true, data: await this.run(a.action, a.payload) };
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    a.status = ApprovalStatus.APPROVED;
    a.decidedById = caller.userId;
    a.decidedAt = new Date();
    a.decisionNote = note?.trim() || null;
    a.result = result;
    await this.repo.save(a);
    await this.notifyRequester(
      a,
      result.ok
        ? `Approved: ${a.summary}`
        : `Approved but failed to apply: ${result.error}`,
    );
    return a;
  }

  async reject(
    caller: ApprovalCaller,
    id: string,
    note?: string,
  ): Promise<AdjustmentApproval> {
    if (!APPROVERS.includes(caller.role)) {
      throw new ForbiddenException('Only a tenant admin can reject.');
    }
    const a = await this.findOne(caller.tenantId, id);
    if (a.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Already ${a.status.toLowerCase()}.`);
    }
    a.status = ApprovalStatus.REJECTED;
    a.decidedById = caller.userId;
    a.decidedAt = new Date();
    a.decisionNote = note?.trim() || null;
    await this.repo.save(a);
    await this.notifyRequester(
      a,
      `Rejected: ${a.summary}${note ? ` — ${note}` : ''}`,
    );
    return a;
  }

  private async notifyRequester(a: AdjustmentApproval, message: string) {
    await this.notifications
      .send(
        a.tenantId,
        {
          title: 'Your concession request was reviewed',
          body: message,
          type: 'approval',
          recipientId: a.requestedById,
          linkUrl: '/approvals',
        },
        a.decidedById ?? null,
      )
      .catch(() => undefined);
  }
}

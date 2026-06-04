import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { FeesService } from '../fees/fees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AdminsService } from '../admins/admins.service';
import { TenantConfigsService } from '../tenant-configs/tenant-configs.service';
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

/** Friendly label for each approval action, used in emails / subjects. */
const ACTION_LABEL: Record<ApprovalAction, string> = {
  [ApprovalAction.DISCOUNT_ADD_BULK]: 'Bulk discount request',
  [ApprovalAction.DISCOUNT_WAIVE_BULK]: 'Bulk discount waive-off request',
  [ApprovalAction.DISCOUNT_ADD_SINGLE]: 'Discount request',
  [ApprovalAction.DISCOUNT_WAIVE_SINGLE]: 'Discount waive-off request',
  [ApprovalAction.PENALTY_WAIVE_BULK]: 'Bulk penalty waive-off request',
  [ApprovalAction.PENALTY_WAIVE_SINGLE]: 'Penalty waive-off request',
};

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    @InjectRepository(AdjustmentApproval)
    private readonly repo: Repository<AdjustmentApproval>,
    private readonly fees: FeesService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly admins: AdminsService,
    private readonly tenantConfigs: TenantConfigsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Apply immediately when the caller is a tenant/super admin, otherwise
   * queue the concession for a tenant admin to approve.
   */
  async gate(
    caller: ApprovalCaller,
    action: ApprovalAction,
    payload: Record<string, any>,
    summary: string,
  ): Promise<unknown> {
    if (APPROVERS.includes(caller.role)) {
      return this.run(action, payload);
    }
    const saved = await this.repo.save(
      this.repo.create({
        tenantId: caller.tenantId,
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
          linkUrl: `/approvals?focus=${saved.id}`,
        },
        caller.userId,
      )
      .catch(() => undefined);
    // Email the tenant admins too, with a deep link straight to this request
    // on the approvals screen. Best-effort — never blocks the request.
    await this.emailApprovers(saved).catch((err) =>
      this.logger.warn(
        `Failed to email approvers for approval ${saved.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    );
    return {
      status: 'pending',
      approvalId: saved.id,
      message:
        'Sent to a tenant admin for approval. It will apply once approved.',
    };
  }

  /**
   * Emails every active tenant admin a concession-approval request with a
   * direct link to the approvals screen (deep-linked to this request). Uses
   * the tenant's own SMTP config when present, falling back to platform SMTP.
   */
  private async emailApprovers(a: AdjustmentApproval): Promise<void> {
    const [admins, cfg] = await Promise.all([
      this.admins.findAll(a.tenantId),
      this.tenantConfigs.findActiveForTenant(a.tenantId),
    ]);

    const recipients = [
      ...new Set(
        admins
          .filter((ad) => ad.role === Role.ADMIN && ad.isActive && ad.email)
          .map((ad) => ad.email.toLowerCase()),
      ),
    ];
    if (!recipients.length) {
      this.logger.warn(
        `No active tenant admins to email for approval ${a.id} (tenant ${a.tenantId}).`,
      );
      return;
    }

    const base = (this.config.get<string>('clientUrl') ?? '').replace(/\/$/, '');
    const approvalUrl = `${base}/approvals?focus=${a.id}`;
    const { subject, html } = this.buildApprovalEmail(a, approvalUrl);

    const smtp = cfg
      ? {
          host: cfg.smtpHost,
          port: cfg.smtpPort,
          user: cfg.smtpUser,
          pass: cfg.smtpPassword,
          fromName: cfg.smtpFromName,
          fromEmail: cfg.smtpFromEmail,
          secure: cfg.smtpSecure,
        }
      : null;

    await Promise.all(
      recipients.map((to) =>
        this.mail.sendForTenant(smtp, to, subject, html).catch((err) =>
          this.logger.warn(
            `Approval email to ${to} failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        ),
      ),
    );
  }

  /** Builds the subject + HTML body for an approval-request email. */
  private buildApprovalEmail(
    a: AdjustmentApproval,
    approvalUrl: string,
  ): { subject: string; html: string } {
    const label = ACTION_LABEL[a.action] ?? 'Approval request';
    const subject = `Approval needed: ${label}`;
    const requestedBy = a.requestedByEmail ?? 'a staff member';
    const role = (a.requestedByRole ?? '').replace(/_/g, ' ');
    const raisedAt = new Date(a.createdAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = `
      <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="margin:0 0 4px;font-size:18px">${label}</h2>
        <p style="margin:0 0 16px;color:#475569;font-size:14px">
          A new request is waiting for your approval.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
          <tr>
            <td style="padding:8px 0;color:#64748b;width:130px">Request</td>
            <td style="padding:8px 0;font-weight:600">${escapeHtml(a.summary)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Requested by</td>
            <td style="padding:8px 0">${escapeHtml(requestedBy)}${role ? ` (${escapeHtml(role)})` : ''}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b">Raised at</td>
            <td style="padding:8px 0">${escapeHtml(raisedAt)}</td>
          </tr>
        </table>
        <a href="${approvalUrl}"
           style="display:inline-block;background:#6c739c;color:#fff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          Review &amp; approve
        </a>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">
          If the button doesn't work, open this link:<br />
          <a href="${approvalUrl}" style="color:#6c739c">${approvalUrl}</a>
        </p>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">
          You'll need to be signed in to the admin portal to approve or reject.
        </p>
      </div>
    `;
    return { subject, html };
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

/** Minimal HTML-escape for user-supplied text inserted into email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

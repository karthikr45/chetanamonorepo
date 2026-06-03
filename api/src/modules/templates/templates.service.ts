import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../../common/enums/roles.enum';

/**
 * Template lifecycle. Mirrors the `template_status` system_metadata
 * vocabulary: a freshly created or resubmitted template sits as
 * 'pending' until a tenant admin moves it to 'approved' or 'rejected'.
 */
export const TEMPLATE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export interface TemplateActor {
  userId: string;
  role: string;
}

const APPROVER_ROLES: string[] = [Role.ADMIN, Role.SUPER_ADMIN];

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templatesRepository: Repository<Template>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateTemplateDto): Promise<Template> {
    const template = this.templatesRepository.create({
      ...dto,
      tenantId,
      status: TEMPLATE_STATUS.PENDING,
    });
    return this.templatesRepository.save(template);
  }

  async findAll(tenantId: string): Promise<Template[]> {
    return this.templatesRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'message', 'status', 'category', 'createdAt'],
    });
  }

  async findOne(tenantId: string, id: string): Promise<Template> {
    const template = await this.templatesRepository.findOne({
      where: { id, tenantId },
      select: [
        'id',
        'name',
        'message',
        'status',
        'category',
        'adminId',
        'createdAt',
      ],
    });
    if (!template) {
      throw new NotFoundException(`Template not found`);
    }
    return template;
  }

  async update(tenantId: string, id: string, dto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(tenantId, id);
    Object.assign(template, dto);
    return this.templatesRepository.save(template);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const template = await this.findOne(tenantId, id);
    await this.templatesRepository.softRemove(template);
  }

  /**
   * Send a previously-rejected or draft template back into review.
   * Anyone in the tenant can submit; tenant admins decide.
   */
  async submitForReview(
    tenantId: string,
    id: string,
    actor: TemplateActor,
  ): Promise<Template> {
    const tpl = await this.findOne(tenantId, id);
    if (tpl.status === TEMPLATE_STATUS.PENDING) {
      return tpl; // idempotent — already in review
    }
    tpl.status = TEMPLATE_STATUS.PENDING;
    const saved = await this.templatesRepository.save(tpl);
    await this.notifyApprovers(saved, actor);
    return saved;
  }

  async approve(
    tenantId: string,
    id: string,
    actor: TemplateActor,
    note?: string,
  ): Promise<Template> {
    this.assertApprover(actor);
    const tpl = await this.findOne(tenantId, id);
    if (tpl.status === TEMPLATE_STATUS.APPROVED) {
      throw new BadRequestException('Template is already approved.');
    }
    tpl.status = TEMPLATE_STATUS.APPROVED;
    const saved = await this.templatesRepository.save(tpl);
    await this.notifyCreator(saved, `Approved${note ? ` — ${note}` : ''}`);
    return saved;
  }

  async reject(
    tenantId: string,
    id: string,
    actor: TemplateActor,
    note?: string,
  ): Promise<Template> {
    this.assertApprover(actor);
    const tpl = await this.findOne(tenantId, id);
    if (tpl.status === TEMPLATE_STATUS.REJECTED) {
      throw new BadRequestException('Template is already rejected.');
    }
    tpl.status = TEMPLATE_STATUS.REJECTED;
    const saved = await this.templatesRepository.save(tpl);
    await this.notifyCreator(saved, `Rejected${note ? ` — ${note}` : ''}`);
    return saved;
  }

  private assertApprover(actor: TemplateActor): void {
    if (!APPROVER_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Only a tenant admin can decide on templates.',
      );
    }
  }

  /** Tenant-admin queue: "Template X needs review". */
  private async notifyApprovers(tpl: Template, actor: TemplateActor) {
    await this.notifications
      .send(
        tpl.tenantId,
        {
          title: 'Template needs review',
          body: `"${tpl.name}" was submitted for approval.`,
          type: 'template',
          recipientRole: Role.ADMIN,
          linkUrl: `/templates/${tpl.id}`,
        },
        actor.userId,
      )
      .catch(() => undefined);
  }

  /** Creator gets the approve/reject decision back. */
  private async notifyCreator(tpl: Template, message: string) {
    if (!tpl.adminId) return;
    await this.notifications
      .send(
        tpl.tenantId,
        {
          title: `Your template was reviewed`,
          body: `${tpl.name}: ${message}`,
          type: 'template',
          recipientId: tpl.adminId,
          linkUrl: `/templates/${tpl.id}`,
        },
        null,
      )
      .catch(() => undefined);
  }
}

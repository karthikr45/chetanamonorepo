import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface AnnouncementActor {
  userId: string;
  role: string;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateAnnouncementDto,
    actor: AnnouncementActor,
  ): Promise<Announcement> {
    const publish = !!dto.publish;
    const row = this.repo.create({
      tenantId,
      title: dto.title,
      body: dto.body ?? null,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
      audienceRole: dto.audienceRole ?? null,
      publishedAt: publish ? new Date() : null,
      createdBy: actor.userId,
    });
    const saved = await this.repo.save(row);
    if (publish) await this.notifyAudience(saved, actor);
    return saved;
  }

  /** Lists drafts + published; UI can filter on `publishedAt`. */
  findAll(tenantId: string): Promise<Announcement[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Audience-only view: published rows matching the caller's role. */
  findVisible(tenantId: string, role: string): Promise<Announcement[]> {
    return this.repo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.publishedAt IS NOT NULL')
      .andWhere('(a.audienceRole IS NULL OR a.audienceRole = :role)', { role })
      .orderBy('a.publishedAt', 'DESC')
      .take(200)
      .getMany();
  }

  async findOne(tenantId: string, id: string): Promise<Announcement> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  /**
   * Editing a published row notifies again only when content changed AND
   * the caller asked for it via `publish: true` in the patch. That keeps
   * trivial typo fixes from spamming the audience.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateAnnouncementDto,
    actor: AnnouncementActor,
  ): Promise<Announcement> {
    const row = await this.findOne(tenantId, id);
    const wasPublished = !!row.publishedAt;

    if (dto.title !== undefined) row.title = dto.title;
    if (dto.body !== undefined) row.body = dto.body ?? null;
    if (dto.eventDate !== undefined) {
      row.eventDate = dto.eventDate ? new Date(dto.eventDate) : null;
    }
    if (dto.audienceRole !== undefined) {
      row.audienceRole = dto.audienceRole ?? null;
    }

    let republished = false;
    if (dto.publish === true && !wasPublished) {
      row.publishedAt = new Date();
      republished = true;
    }

    const saved = await this.repo.save(row);
    if (republished) await this.notifyAudience(saved, actor);
    return saved;
  }

  /** Explicit publish step for draft rows. Idempotent on already-live. */
  async publish(
    tenantId: string,
    id: string,
    actor: AnnouncementActor,
  ): Promise<Announcement> {
    const row = await this.findOne(tenantId, id);
    if (row.publishedAt) return row;
    row.publishedAt = new Date();
    const saved = await this.repo.save(row);
    await this.notifyAudience(saved, actor);
    return saved;
  }

  async unpublish(tenantId: string, id: string): Promise<Announcement> {
    const row = await this.findOne(tenantId, id);
    if (!row.publishedAt) {
      throw new BadRequestException('Already a draft.');
    }
    row.publishedAt = null;
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.softRemove(row);
  }

  /** One in-app notification to the audience role (or all if null). */
  private async notifyAudience(
    a: Announcement,
    actor: AnnouncementActor,
  ): Promise<void> {
    try {
      await this.notifications.send(
        a.tenantId,
        {
          title: a.title,
          body: a.body ?? undefined,
          type: 'announcement',
          recipientRole: a.audienceRole ?? undefined,
          linkUrl: `/announcements/${a.id}`,
        },
        actor.userId,
      );
    } catch (err) {
      // Don't fail the publish if the notification write hiccups.
      this.logger.warn(
        `Announcement ${a.id} published but notification failed: ${(err as Error).message}`,
      );
    }
  }

  /** Used by tests / housekeeping — list pending drafts. */
  findDrafts(tenantId: string): Promise<Announcement[]> {
    return this.repo.find({
      where: { tenantId, publishedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /** Used by tests / housekeeping — list published rows. */
  findPublished(tenantId: string): Promise<Announcement[]> {
    return this.repo.find({
      where: { tenantId, publishedAt: Not(IsNull()) },
      order: { publishedAt: 'DESC' },
    });
  }
}

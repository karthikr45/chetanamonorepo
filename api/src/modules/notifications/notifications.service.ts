import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async send(
    tenantId: string,
    dto: CreateNotificationDto,
    createdBy: string | null,
  ): Promise<Notification> {
    const n = this.repo.create({
      tenantId,
      recipientId: dto.recipientId ?? null,
      recipientRole: dto.recipientId ? null : (dto.recipientRole ?? null),
      title: dto.title,
      body: dto.body ?? null,
      type: dto.type ?? 'general',
      linkUrl: dto.linkUrl ?? null,
      createdBy,
    });
    return this.repo.save(n);
  }

  /** Notifications visible to a user: targeted to them, or a broadcast. */
  private visibleQuery(tenantId: string, userId: string, role: string) {
    return this.repo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('n.recipientId = :userId', { userId }).orWhere(
            new Brackets((bb) => {
              bb.where('n.recipientId IS NULL').andWhere(
                new Brackets((rb) => {
                  rb.where('n.recipientRole IS NULL').orWhere(
                    'n.recipientRole = :role',
                    { role },
                  );
                }),
              );
            }),
          );
        }),
      );
  }

  findAll(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<Notification[]> {
    return this.visibleQuery(tenantId, userId, role)
      .orderBy('n.createdAt', 'DESC')
      .take(100)
      .getMany();
  }

  unreadCount(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<number> {
    return this.visibleQuery(tenantId, userId, role)
      .andWhere('n.isRead = false')
      .getCount();
  }

  async markRead(
    tenantId: string,
    id: string,
    userId: string,
    role: string,
  ): Promise<Notification> {
    const n = await this.visibleQuery(tenantId, userId, role)
      .andWhere('n.id = :id', { id })
      .getOne();
    if (!n) throw new NotFoundException(`Notification ${id} not found`);
    if (!n.isRead) {
      n.isRead = true;
      n.readAt = new Date();
      await this.repo.save(n);
    }
    return n;
  }

  async markAllRead(
    tenantId: string,
    userId: string,
    role: string,
  ): Promise<{ updated: number }> {
    const rows = await this.visibleQuery(tenantId, userId, role)
      .andWhere('n.isRead = false')
      .getMany();
    if (rows.length === 0) return { updated: 0 };
    const now = new Date();
    for (const r of rows) {
      r.isRead = true;
      r.readAt = now;
    }
    await this.repo.save(rows);
    return { updated: rows.length };
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const n = await this.repo.findOne({ where: { id, tenantId } });
    if (!n) throw new NotFoundException(`Notification ${id} not found`);
    await this.repo.remove(n);
  }
}

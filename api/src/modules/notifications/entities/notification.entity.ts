import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * In-app notification. Either targeted (recipientId set) or a broadcast
 * (recipientId null + optional recipientRole). A broadcast is a single
 * row whose visibility is resolved on read; its read-state is therefore
 * shared across recipients (fine for admin announcements).
 */
@Index('idx_notif_tenant_recipient', ['tenantId', 'recipientId', 'createdAt'])
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** Null = broadcast to a role/everyone in the tenant. */
  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  @Column({ name: 'recipient_role', type: 'varchar', length: 50, nullable: true })
  recipientRole: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Free-form category for client-side routing/icons. */
  @Column({ type: 'varchar', length: 50, default: 'general' })
  type: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  linkUrl: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tenant-scoped event / announcement. A row is a draft until
 * `publishedAt` is set; publishing fires an in-app notification to the
 * intended audience.
 *
 * `audienceRole`:
 *   null       → everyone in the tenant
 *   'parent'   → parents only
 *   'admin'    → admins (school staff) only
 *   any role   → that role only
 */
@Entity('announcements')
@Index('idx_announcements_tenant_published', ['tenantId', 'publishedAt'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Optional date the event takes place — for calendar items. */
  @Column({ name: 'event_date', type: 'timestamptz', nullable: true })
  eventDate: Date | null;

  /** Null = broadcast to the whole tenant. */
  @Column({ name: 'audience_role', type: 'varchar', length: 50, nullable: true })
  audienceRole: string | null;

  /** Null = draft. Set on publish; fans out a notification. */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

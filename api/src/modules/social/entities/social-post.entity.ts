import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SocialPostKind {
  POST = 'POST',
  EVENT = 'EVENT',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

/**
 * A school feed entry — could be a normal post, an event, or an
 * announcement. Visible publicly by default so prospective families
 * can browse a school's activity before logging in.
 */
@Entity('social_posts')
@Index('idx_social_posts_tenant_published', ['tenantId', 'isPublished', 'createdAt'])
@Index('idx_social_posts_public_published', ['isPublic', 'isPublished', 'createdAt'])
export class SocialPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** Snapshot of the admin who authored. Nullable if the admin is removed. */
  @Column({ name: 'author_admin_id', type: 'uuid', nullable: true })
  authorAdminId: string | null;

  @Column({ name: 'author_name', type: 'varchar', length: 150, nullable: true })
  authorName: string | null;

  @Column({ type: 'enum', enum: SocialPostKind, default: SocialPostKind.POST })
  kind: SocialPostKind;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Short plain-text excerpt shown in feed cards. */
  @Column({ type: 'varchar', length: 280, nullable: true })
  excerpt: string | null;

  /** Rich HTML body — produced by the WYSIWYG editor on the admin side. */
  @Column({ type: 'text', default: '' })
  body: string;

  /** EVENT-only. ISO date/time. */
  @Column({ name: 'event_at', type: 'timestamptz', nullable: true })
  eventAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  /** Comma-separated lower-case tags for now (e.g. "sports,annual-day"). */
  @Column({ type: 'varchar', length: 300, nullable: true })
  tags: string | null;

  /** When true, the post is included in the public feed (login not required). */
  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic: boolean;

  /** Draft / published toggle. Drafts are admin-only. */
  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

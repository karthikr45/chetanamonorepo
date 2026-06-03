import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Comment on a social post. Authored by an authenticated user — either
 * an admin (admins.id) or a parent (parents.id). We snapshot the author
 * id + display name so the comment survives the user being removed.
 */
@Entity('social_comments')
@Index('idx_social_comments_post_created', ['postId', 'createdAt'])
export class SocialComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  /** 'admin' or 'parent' — controls which table the author_id points at. */
  @Column({ name: 'author_kind', type: 'varchar', length: 20 })
  authorKind: 'admin' | 'parent';

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'author_name', type: 'varchar', length: 150, nullable: true })
  authorName: string | null;

  @Column({ type: 'varchar', length: 1000 })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

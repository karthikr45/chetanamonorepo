import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * One reaction (like) per (post, user). Unique constraint enforces
 * that the same user can't double-like. We only support a single
 * "heart" reaction for now — schema-wise easy to extend.
 */
@Entity('social_reactions')
@Unique('uq_social_reactions_post_user', ['postId', 'authorKind', 'authorId'])
@Index('idx_social_reactions_post', ['postId'])
export class SocialReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'author_kind', type: 'varchar', length: 20 })
  authorKind: 'admin' | 'parent';

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

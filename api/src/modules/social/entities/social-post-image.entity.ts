import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Image attached to a social post. Stored as a data URI in the DB
 * (text column) for MVP — same approach we use for receipt template
 * logos. Order column controls gallery sequence.
 */
@Entity('social_post_images')
@Index('idx_social_post_images_post_order', ['postId', 'order'])
export class SocialPostImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alt: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

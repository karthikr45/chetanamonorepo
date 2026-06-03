import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One-on-one (or future N-way) chat between admin users. The set of
 * participants is stored in conversation_participants and the messages
 * in chat_messages.
 *
 * `lastMessageAt` is denormalised so the conversations list sorts
 * cheaply without joining messages.
 */
@Entity('conversations')
@Index('idx_conversations_last_msg', ['lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Snapshot of the most recent message body for the list preview. */
  @Column({ name: 'last_message_preview', type: 'varchar', length: 200, nullable: true })
  lastMessagePreview: string | null;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

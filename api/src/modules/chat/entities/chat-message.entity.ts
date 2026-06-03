import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A single chat message. Sender is always an admin (admins.id). The
 * conversation determines who else can see it (via conversation_participants).
 */
@Entity('chat_messages')
@Index('idx_chat_messages_conv_created', ['conversationId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text', default: '' })
  body: string;

  /** Message this one replies to / quotes (same conversation). */
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;

  // Single optional attachment.
  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column({
    name: 'attachment_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  attachmentName: string | null;

  @Column({
    name: 'attachment_mime',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  attachmentMime: string | null;

  @Column({ name: 'attachment_size', type: 'int', nullable: true })
  attachmentSize: number | null;

  // Multi-file attachments (preferred). The legacy single columns above
  // remain readable for old rows.
  @Column({ type: 'jsonb', nullable: true })
  attachments:
    | { url: string; name: string; mime: string; size: number }[]
    | null;

  // Emoji reactions: { "👍": [adminId, ...], "❤️": [...] }.
  @Column({ type: 'jsonb', nullable: true })
  reactions: Record<string, string[]> | null;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  // Soft delete kept as a plain column (NOT @DeleteDateColumn) so the
  // row is still returned and rendered as "This message was deleted".
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

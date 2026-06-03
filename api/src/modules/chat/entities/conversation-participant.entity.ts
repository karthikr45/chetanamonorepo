import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Membership row linking an admin user to a conversation. Each row
 * tracks that participant's `lastReadMessageId` so we can compute
 * per-user unread counts cheaply.
 */
@Entity('conversation_participants')
@Unique('uq_conv_participants_conv_admin', ['conversationId', 'adminId'])
@Index('idx_conv_participants_admin', ['adminId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  /** FK to admins.id — the only user table this chat uses today. */
  @Column({ name: 'admin_id', type: 'uuid' })
  adminId: string;

  /** Snapshot of the participant's tenant at join time. Null for super-admins. */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  /** ID of the last message this participant has seen. Null = never read. */
  @Column({ name: 'last_read_message_id', type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

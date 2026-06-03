import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ApprovalAction {
  DISCOUNT_ADD_BULK = 'DISCOUNT_ADD_BULK',
  DISCOUNT_WAIVE_BULK = 'DISCOUNT_WAIVE_BULK',
  PENALTY_WAIVE_BULK = 'PENALTY_WAIVE_BULK',
  DISCOUNT_ADD_SINGLE = 'DISCOUNT_ADD_SINGLE',
  DISCOUNT_WAIVE_SINGLE = 'DISCOUNT_WAIVE_SINGLE',
  PENALTY_WAIVE_SINGLE = 'PENALTY_WAIVE_SINGLE',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * A concession (discount / waive-off) raised by a fin/ops admin that a
 * tenant admin must approve before it is applied. Holds the exact
 * payload so approval re-runs the same FeesService call.
 */
@Index('idx_approvals_tenant_status', ['tenantId', 'status', 'createdAt'])
@Entity('adjustment_approvals')
export class AdjustmentApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branch: string | null;

  @Column({ type: 'enum', enum: ApprovalAction })
  action: ApprovalAction;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  /** Human-readable one-liner shown in the list/notification. */
  @Column({ type: 'text' })
  summary: string;

  /** Everything FeesService needs to execute on approval. */
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @Column({ name: 'requested_by_email', type: 'varchar', nullable: true })
  requestedByEmail: string | null;

  @Column({ name: 'requested_by_role', type: 'varchar', length: 50 })
  requestedByRole: string;

  @Column({ name: 'decided_by_id', type: 'uuid', nullable: true })
  decidedById: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  /** Result/error captured when the approved action ran. */
  @Column({ name: 'result', type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

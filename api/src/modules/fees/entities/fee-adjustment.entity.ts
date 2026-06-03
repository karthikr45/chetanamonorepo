import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum FeeAdjustmentKind {
  PENALTY_ADD = 'PENALTY_ADD',
  PENALTY_WAIVE = 'PENALTY_WAIVE',
  DISCOUNT_ADD = 'DISCOUNT_ADD',
  DISCOUNT_WAIVE = 'DISCOUNT_WAIVE',
}

/**
 * Audit row written on every penalty / discount mutation. Used by
 * Payment Details to render a unified history (payments + adjustments)
 * and to satisfy the "who did what, when, why" requirement schools
 * have for fee changes.
 *
 * Single-fee operations write one row. Bulk operations write one row
 * per affected fee — each row is self-sufficient so reports don't have
 * to join back to a "bulk operation" table.
 */
@Entity('fee_adjustments')
@Index('idx_fee_adjustments_fee_created', ['feeId', 'createdAt'])
@Index('idx_fee_adjustments_tenant_created', ['tenantId', 'createdAt'])
export class FeeAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'fee_id', type: 'uuid' })
  feeId: string;

  @Column({ type: 'enum', enum: FeeAdjustmentKind })
  kind: FeeAdjustmentKind;

  /** Always stored positive — the kind tells direction. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** Free-text reason captured from the actor at the time of the change. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Snapshot of the admin/user who triggered the change. Nullable for system actions. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'created_by_email', type: 'varchar', length: 255, nullable: true })
  createdByEmail: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

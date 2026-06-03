import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Atomic per-tenant per-period running counter used by the receipt-number
 * generator. One row per (tenantId, periodKey). The generator does a
 * `SELECT ... FOR UPDATE` on the matching row to serialise concurrent
 * payments and increment `currentValue` exactly once per issued receipt.
 *
 * `periodKey` shape depends on the tenant's ReceiptResetPolicy:
 *   NEVER          → "GLOBAL"
 *   YEARLY         → "2025"
 *   ACADEMIC_YEAR  → "2025-2026"   (or the student's academic year)
 *   MONTHLY        → "2025-10"
 *   DAILY          → "20251025"
 */
@Entity('receipt_sequences')
@Unique('uq_receipt_sequences_tenant_period', ['tenantId', 'periodKey'])
export class ReceiptSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'period_key', type: 'varchar', length: 30 })
  periodKey: string;

  /** The most recently-issued receipt number for this period. */
  @Column({ name: 'current_value', type: 'int', default: 0 })
  currentValue: number;

  /** Stamped each time a new receipt is handed out from this row. */
  @Column({ name: 'last_issued_at', type: 'timestamptz', nullable: true })
  lastIssuedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

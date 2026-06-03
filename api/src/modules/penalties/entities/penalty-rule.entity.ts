import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TermType } from '../../fees/entities/fee.entity';

export enum PenaltyAmountType {
  FLAT = 'FLAT',
  PER_DAY = 'PER_DAY',
}

/**
 * Tenant-configurable rule for auto-applying penalties to overdue fees.
 *
 * Examples (TS/AP school standards):
 *   - "₹100/day after 15 days late, max ₹1500" → amountType=PER_DAY,
 *     amount=100, triggerAfterDays=15, maxAmount=1500
 *   - "₹500 flat after 30 days" → amountType=FLAT, amount=500,
 *     triggerAfterDays=30, maxAmount=null
 *
 * Scope:
 *   - term null    → applies to every term
 *   - year null    → applies to every academic year
 *   - both null    → applies to every fee in the tenant
 */
@Entity('penalty_rules')
@Index('idx_pr_tenant_active', ['tenantId', 'isActive'])
export class PenaltyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 20, nullable: true })
  academicYear: string | null;

  @Column({ type: 'enum', enum: TermType, nullable: true })
  term: TermType | null;

  @Column({ name: 'trigger_after_days', type: 'int', default: 0 })
  triggerAfterDays: number;

  @Column({
    name: 'amount_type',
    type: 'enum',
    enum: PenaltyAmountType,
    default: PenaltyAmountType.FLAT,
  })
  amountType: PenaltyAmountType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'max_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxAmount: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

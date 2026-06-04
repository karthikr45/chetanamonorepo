import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';

export enum TermType {
  FIRST = '1st Term Fee',
  SECOND = '2nd Term Fee',
  THIRD = '3rd Term Fee',
  FOURTH = '4th Term Fee',
  FIFTH = '5th Term Fee',
}

/**
 * Monthly billing periods (academic year Apr–Mar). Mirrors the `month`
 * system_metadata rows, the same way TermType mirrors `term`. Used by
 * tenants whose billing mode is monthly (e.g. transport).
 */
export enum MonthType {
  APRIL = 'April',
  MAY = 'May',
  JUNE = 'June',
  JULY = 'July',
  AUGUST = 'August',
  SEPTEMBER = 'September',
  OCTOBER = 'October',
  NOVEMBER = 'November',
  DECEMBER = 'December',
  JANUARY = 'January',
  FEBRUARY = 'February',
  MARCH = 'March',
}

/** A fee's billing period — a school/hostel term or a transport month. */
export type FeePeriod = TermType | MonthType;

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

/**
 * One row per (student, term). The "bill":
 *   original_amount  — what the Excel uploaded
 *   total_penalty    — sum of applied penalties
 *   total_discount   — sum of applied discounts
 *   net_amount       = original + penalty − discount  (what they owe)
 *   paid_amount      = sum of rows in fee_payments    (what they've paid)
 *   payment_status   = derived:
 *                        paid_amount == 0          → UNPAID
 *                        0 < paid_amount < net     → PARTIAL
 *                        paid_amount == net        → PAID
 *
 * Individual payments live in `fee_payments` — one row per installment.
 */
@Entity('fees')
@Unique('uq_fees_tenant_student_year_term', [
  'tenantId',
  'studentId',
  'academicYear',
  'term',
])
@Index('idx_fees_tenant_year', ['tenantId', 'academicYear'])
@Index('idx_fees_tenant_status', ['tenantId', 'paymentStatus'])
@Check('chk_fees_original_amount_non_negative', '"original_amount" >= 0')
@Check('chk_fees_penalty_non_negative', '"total_penalty" >= 0')
@Check('chk_fees_discount_non_negative', '"total_discount" >= 0')
@Check('chk_fees_paid_amount_non_negative', '"paid_amount" >= 0')
export class Fee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 20 })
  academicYear: string;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  /**
   * Billing period: a TermType value (school/hostel) or a MonthType
   * value (monthly tenants like transport). Stored as text so both
   * vocabularies share one column and one fee/payment pipeline.
   */
  @Column({ type: 'varchar', length: 30 })
  term: FeePeriod;

  @Column({ name: 'original_amount', type: 'decimal', precision: 12, scale: 2 })
  originalAmount: string;

  @Column({ name: 'total_penalty', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPenalty: string;

  @Column({ name: 'total_discount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDiscount: string;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2 })
  netAmount: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: string;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  // ─── Transport (monthly tenants only) ────────────────────────────
  // Boarding / drop point for THIS month's bill. Lets transport tenants
  // change pickup/drop month-wise; null for term-wise (school/hostel) fees.
  @Column({ name: 'pickup_location', type: 'varchar', length: 200, nullable: true })
  pickupLocation: string | null;

  @Column({ name: 'drop_location', type: 'varchar', length: 200, nullable: true })
  dropLocation: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
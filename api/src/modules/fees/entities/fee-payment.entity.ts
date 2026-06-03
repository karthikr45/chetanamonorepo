import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  Unique,
} from 'typeorm';
import { Fee } from './fee.entity';

export enum PaymentType {
  // Online (gateway-inserted via webhook)
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  UPI = 'UPI',
  NETBANKING = 'NETBANKING',
  CARD = 'CARD',
  // Offline (admin-inserted)
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  DD = 'DD',
  POS = 'POS',
  NEFT = 'NEFT',
}

export enum ClearanceStatus {
  /** Default for cheque/DD until the bank clears or bounces it. */
  PENDING = 'PENDING',
  /** Bank confirmed the funds have settled. */
  CLEARED = 'CLEARED',
  /** Cheque bounced — payment is reversed. */
  BOUNCED = 'BOUNCED',
  /** Not applicable — cash, POS, online, NEFT etc. clear instantly. */
  NA = 'NA',
}

/**
 * One row per payment installment. A fee with three part payments has
 * three rows here.
 *
 * Online payments come in via the gateway webhook (`order_id`,
 * `transaction_id`, `payment_type ∈ {RAZORPAY|CASHFREE|UPI|...}`).
 * Offline payments are recorded by admin staff via
 * `POST /api/fees/:feeId/payments` — the relevant offline fields
 * (`cheque_*`, `dd_*`, `pos_*`) are populated.
 *
 * Cheques and DDs use `clearance_status` to track bank settlement.
 * BOUNCED reverses the payment (subtracted from the fee's paid_amount).
 *
 * Every row carries an auto-generated `receipt_number` for printing.
 */
@Entity('fee_payments')
@Index('idx_fp_fee', ['feeId'])
@Index('idx_fp_tenant_paid_at', ['tenantId', 'paidAt'])
@Index('idx_fp_clearance_pending', ['tenantId', 'clearanceStatus'])
@Unique('uq_fp_receipt_number', ['receiptNumber'])
@Check('chk_fp_amount_positive', '"amount" > 0')
export class FeePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  branch: string;

  @ManyToOne(() => Fee, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'fee_id' })
  fee: Fee;

  @Column({ name: 'fee_id', type: 'uuid' })
  feeId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType })
  paymentType: PaymentType;

  /** Auto-generated receipt number (e.g. RCP-SVBK-20260510-0001). */
  @Column({ name: 'receipt_number', type: 'varchar', length: 50, nullable: true })
  receiptNumber: string | null;

  /** Gateway order id (Razorpay/Cashfree). */
  @Column({ name: 'order_id', type: 'varchar', length: 100, nullable: true })
  orderId: string | null;

  /** Gateway / POS / NEFT transaction id. */
  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  // ── Cheque ──
  @Column({ name: 'cheque_number', type: 'varchar', length: 50, nullable: true })
  chequeNumber: string | null;

  @Column({ name: 'cheque_date', type: 'date', nullable: true })
  chequeDate: Date | null;

  // ── DD ──
  @Column({ name: 'dd_number', type: 'varchar', length: 50, nullable: true })
  ddNumber: string | null;

  @Column({ name: 'dd_date', type: 'date', nullable: true })
  ddDate: Date | null;

  // ── Shared bank fields (cheque / DD / NEFT) ──
  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_branch', type: 'varchar', length: 100, nullable: true })
  bankBranch: string | null;

  /** Name on the cheque / DD (drawer). Required for cheque/DD. */
  @Column({ name: 'drawer_name', type: 'varchar', length: 150, nullable: true })
  drawerName: string | null;

  // ── POS (card swipe at school's terminal) ──
  /** Last 4 digits of the card swiped at POS. */
  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  /** Cheques start as PENDING; cash/POS/online/NEFT default to NA. */
  @Column({
    name: 'clearance_status',
    type: 'enum',
    enum: ClearanceStatus,
    default: ClearanceStatus.NA,
  })
  clearanceStatus: ClearanceStatus;

  /** Free-text note from the admin. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** When the money was actually received. */
  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  /** Admin user who recorded the payment. Null for webhook-inserted rows. */
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

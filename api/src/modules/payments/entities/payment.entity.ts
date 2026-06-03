import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Fee } from '../../fees/entities/fee.entity';

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  CASHFREE = 'cashfree',
}

export enum PaymentStatus {
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** Channel a payment came through. */
export enum PaymentType {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

/**
 * The concrete payment instrument. Online instruments are gateway-fed via
 * webhook; offline ones are recorded by admin staff.
 */
export enum PaymentMethod {
  // Online
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  UPI = 'UPI',
  NETBANKING = 'NETBANKING',
  CARD = 'CARD',
  // Offline
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
 * Unified payments ledger — the single source of truth for every payment,
 * online or offline. This row plays two roles over its lifetime:
 *
 *  1. **Gateway order** (online only): created with `status=CREATED` and a
 *     `gateway_order_id` when a payer starts checkout. The webhook / verify
 *     flow flips it to PAID.
 *  2. **Settled ledger entry**: once recognised it carries a
 *     `receipt_number`, a `method`, and (for cheque/DD) a `clearance_status`.
 *     Offline payments are inserted directly in this settled form.
 *
 * A row is treated as a **ledger entry** (counted in collections, receipts,
 * statements) exactly when `receipt_number IS NOT NULL`. CREATED/FAILED
 * orders never get a receipt number, so they're naturally excluded.
 *
 * `amount` is in **rupees** (`decimal`). The gateway boundary converts
 * paise↔rupees; everything downstream works in rupees.
 */
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'paidAt'])
@Index(['tenantId', 'clearanceStatus'])
@Index(['feeId'])
@Unique('uq_payments_receipt_number', ['receiptNumber'])
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @ManyToOne(() => Fee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fee_id' })
  fee: Fee | null;

  @Column({ name: 'fee_id', type: 'uuid', nullable: true })
  feeId: string | null;

  /** Channel (online / offline). */
  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType, default: PaymentType.ONLINE })
  paymentType: PaymentType;

  /** Concrete instrument (CASH / CHEQUE / RAZORPAY / …). Null until known. */
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  method: PaymentMethod | null;

  @Column({ type: 'enum', enum: PaymentGateway, nullable: true })
  gateway: PaymentGateway | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED })
  status: PaymentStatus;

  /** Amount in rupees. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', default: 'INR' })
  currency: string;

  /** Auto-generated receipt number — set when the payment is recognised. */
  @Column({ name: 'receipt_number', type: 'varchar', length: 50, nullable: true })
  receiptNumber: string | null;

  // ── Gateway identifiers ──
  @Column({ type: 'varchar', unique: true, nullable: true })
  gatewayOrderId: string | null;

  @Column({ type: 'varchar', nullable: true })
  gatewayPaymentId: string | null;

  /** Gateway order id mirrored onto the ledger row (alias of gatewayOrderId). */
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

  @Column({ name: 'drawer_name', type: 'varchar', length: 150, nullable: true })
  drawerName: string | null;

  // ── POS ──
  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  /** Cheques/DD start PENDING; cash/POS/online/NEFT default to NA. */
  @Column({
    name: 'clearance_status',
    type: 'enum',
    enum: ClearanceStatus,
    default: ClearanceStatus.NA,
  })
  clearanceStatus: ClearanceStatus;

  // Stores admission, academicYear, term, studentName, email as JSON string
  // (gateway orders) or a free-text admin note (offline ledger rows).
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Set when status transitions to PAID / the money was received.
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /** Admin user who recorded the payment. Null for gateway/webhook rows. */
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  // Gateway error code/description when status transitions to FAILED
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  // Refund tracking (rupees) — used when status transitions to REFUNDED
  @Column({ name: 'refunded_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  refundedAmount: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

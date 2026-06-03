import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
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

export enum PaymentType {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
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

  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType, default: PaymentType.ONLINE })
  paymentType: PaymentType;

  @Column({ type: 'enum', enum: PaymentGateway, nullable: true })
  gateway: PaymentGateway | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED })
  status: PaymentStatus;

  // Gateway-issued order/session ID (null for offline payments)
  @Column({ type: 'varchar', unique: true, nullable: true })
  gatewayOrderId: string | null;

  // Filled after successful payment
  @Column({ type: 'varchar', nullable: true })
  gatewayPaymentId: string | null;

  // Offline payment fields
  @Column({ name: 'cheque_number', type: 'varchar', length: 50, nullable: true })
  chequeNumber: string | null;

  @Column({ name: 'cheque_date', type: 'date', nullable: true })
  chequeDate: Date | null;

  @Column({ name: 'dd_date', type: 'date', nullable: true })
  ddDate: Date | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', default: 'INR' })
  currency: string;

  // Stores admission, academicYear, term, studentName, email as JSON string
  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  // Set when status transitions to PAID
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  // Gateway error code/description when status transitions to FAILED
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  // Refund tracking (used when status transitions to REFUNDED)
  @Column({ type: 'int', nullable: true })
  refundedAmount: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

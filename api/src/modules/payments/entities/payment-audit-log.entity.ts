import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  // Order lifecycle
  ORDER_CREATED = 'ORDER_CREATED',

  // Frontend verify-payment call
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
  PAYMENT_VERIFY_FAILED = 'PAYMENT_VERIFY_FAILED',

  // Webhook pipeline
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  WEBHOOK_SIGNATURE_FAILED = 'WEBHOOK_SIGNATURE_FAILED',
  WEBHOOK_GATEWAY_UNKNOWN = 'WEBHOOK_GATEWAY_UNKNOWN',
  WEBHOOK_DUPLICATE = 'WEBHOOK_DUPLICATE',
  WEBHOOK_ORDER_NOT_FOUND = 'WEBHOOK_ORDER_NOT_FOUND',

  // Status transitions
  PAYMENT_STATUS_CHANGED = 'PAYMENT_STATUS_CHANGED',
}

@Index(['tenantId', 'createdAt'])
@Index(['gatewayOrderId'])
@Index(['paymentId'])
@Entity('payment_audit_logs')
export class PaymentAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  /** Internal payments.id — nullable because some events arrive before a DB record exists */
  @Column({ type: 'varchar', nullable: true })
  paymentId: string | null;

  /** Internal transactions.id — set only when a transaction was created alongside this event */
  @Column({ type: 'varchar', nullable: true })
  transactionId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  /** razorpay | cashfree | unknown */
  @Column({ type: 'varchar', nullable: true })
  gateway: string | null;

  @Column({ type: 'varchar', nullable: true })
  gatewayOrderId: string | null;

  @Column({ type: 'varchar', nullable: true })
  gatewayPaymentId: string | null;

  /** Raw gateway event name (e.g. PAYMENT_SUCCESS_WEBHOOK, payment.authorized) */
  @Column({ type: 'varchar', nullable: true })
  eventType: string | null;

  /** Payment status before this event */
  @Column({ type: 'varchar', nullable: true })
  fromStatus: string | null;

  /** Payment status after this event */
  @Column({ type: 'varchar', nullable: true })
  toStatus: string | null;

  /** 'webhook', 'api', 'system' */
  @Column({ type: 'varchar', nullable: true })
  actor: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'boolean', default: false })
  isError: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Raw payload / headers snapshot — store everything here so nothing is ever lost.
   * For webhooks: full gateway payload.
   * For verify-payment: the VerifyPaymentDto fields (no secrets).
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

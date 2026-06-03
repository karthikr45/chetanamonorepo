import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment, PaymentGateway, PaymentStatus } from './payment.entity';

export enum TransactionType {
  ORDER_CREATED = 'order_created',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'varchar' })
  paymentId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: PaymentGateway })
  gateway: PaymentGateway;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @Column({ type: 'varchar' })
  gatewayOrderId: string;

  // Null until a gateway payment ID is assigned (absent for ORDER_CREATED transactions)
  @Column({ type: 'varchar', nullable: true })
  gatewayPaymentId: string | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', default: 'INR' })
  currency: string;

  // Stores admission, academicYear, term, studentName, email
  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  // Raw gateway order/payment response
  @Column({ type: 'jsonb', nullable: true })
  paymentDetails: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

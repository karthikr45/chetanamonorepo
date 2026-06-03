import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * How often the receipt-number running sequence rolls back to the
 * tenant's configured start. ACADEMIC_YEAR is the default because most
 * Indian schools want one continuous sequence per academic year.
 */
export enum ReceiptResetPolicy {
  /** Never reset — single global sequence forever. */
  NEVER = 'NEVER',
  /** Reset on January 1st each calendar year. */
  YEARLY = 'YEARLY',
  /** Reset at the start of every new academic year (e.g. 2025-2026). */
  ACADEMIC_YEAR = 'ACADEMIC_YEAR',
  /** Reset at the start of every calendar month. */
  MONTHLY = 'MONTHLY',
  /** Reset at the start of every day. */
  DAILY = 'DAILY',
}

/**
 * Shape of the visible receipt number.
 *
 * COMPACT_ACADEMIC (default): {tenantCode}{AAYY}{NNNN}, no separators —
 *   e.g. tenant "2", AY 2026-2027, seq 1 → "226270001". The sequence
 *   always resets per academic year regardless of receiptResetPolicy.
 *
 * PREFIXED: the legacy {PREFIX}[-{period}]-{NNNN} format, honouring the
 *   tenant's receiptResetPolicy.
 */
export enum ReceiptFormat {
  COMPACT_ACADEMIC = 'COMPACT_ACADEMIC',
  PREFIXED = 'PREFIXED',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  code: string | null;

  @Column({ unique: true })
  tenantCode: string;

  @Column()
  tenantName: string;

  @Column({ nullable: true })
  medium: string;

  /**
   * Service this tenant runs — a `tenant_type` metadata value
   * (School / Hostel / Transport). Sibling tenants for one institution
   * share a school code on their student records.
   */
  @Column({ nullable: true })
  type: string;

  /**
   * The institution this tenant belongs to. Sibling school/hostel/
   * transport tenants for one campus share the same school_code, and
   * student rows inherit it. Optional today so existing tenants don't
   * break; new tenants should set it. Indexed so cross-tenant
   * aggregation by school code is cheap.
   */
  @Index('idx_tenants_school_code')
  @Column({ name: 'school_code', type: 'varchar', length: 32, nullable: true })
  schoolCode: string | null;

  /**
   * Billing mode for this tenant's fees — a `billing_mode` metadata
   * value (`term_wise` | `monthly`). Admin-selected. When null, the
   * effective mode is derived from `type` (transport → monthly,
   * otherwise term-wise).
   */
  @Column({ name: 'billing_mode', type: 'varchar', length: 20, nullable: true })
  billingMode: string | null;

  /**
   * Per-tenant monetization gate. Off by default so the six pilot
   * institutions run free; flip on (per tenant, by super-admin) once
   * the subscription/invoice flow exists.
   */
  @Column({ name: 'monetization_enabled', type: 'boolean', default: false })
  monetizationEnabled: boolean;

  @Column({ nullable: true })
  boardType: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  secretKey: string;

  // ─── Receipt numbering ────────────────────────────────────────────
  /**
   * Human-readable prefix for receipts (e.g. "SVBK"). When null, the
   * generator falls back to tenant.code → tenant.tenantCode → "RCP".
   */
  @Column({ name: 'receipt_prefix', type: 'varchar', length: 20, nullable: true })
  receiptPrefix: string | null;

  /** How the running sequence resets. Default ACADEMIC_YEAR. */
  @Column({
    name: 'receipt_reset_policy',
    type: 'enum',
    enum: ReceiptResetPolicy,
    default: ReceiptResetPolicy.ACADEMIC_YEAR,
  })
  receiptResetPolicy: ReceiptResetPolicy;

  /** First number issued in any fresh period. Most schools start at 1. */
  @Column({ name: 'receipt_start_number', type: 'int', default: 1 })
  receiptStartNumber: number;

  /** Visible receipt-number shape. Default compact academic-year format. */
  @Column({
    name: 'receipt_format',
    type: 'enum',
    enum: ReceiptFormat,
    default: ReceiptFormat.COMPACT_ACADEMIC,
  })
  receiptFormat: ReceiptFormat;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Which payment source(s) a template applies to. A receipt issued for
 * an online (gateway) payment will prefer a template with kind = ONLINE
 * or BOTH; an offline payment will prefer OFFLINE or BOTH.
 */
export enum ReceiptTemplateKind {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BOTH = 'BOTH',
}

/**
 * Per-tenant receipt template. Three editable HTML fragments —
 * header / body / footer — with mustache-style placeholders like
 * `{{student.name}}` or `{{payment.amountInWords}}` that the renderer
 * fills in from the actual fee / payment / student / tenant rows.
 *
 * Setting `isDefault = true` makes this the template the auto-renderer
 * picks for receipts of its kind. Old payments keep their original
 * receipt content; new ones use the active default.
 */
@Entity('receipt_templates')
@Unique('uq_receipt_templates_tenant_name', ['tenantId', 'name'])
@Index('idx_receipt_templates_tenant_active', ['tenantId', 'isActive'])
export class ReceiptTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ReceiptTemplateKind,
    default: ReceiptTemplateKind.BOTH,
  })
  kind: ReceiptTemplateKind;

  /** HTML rendered above the body. School logo, address, tagline, etc. */
  @Column({ name: 'header_html', type: 'text', default: '' })
  headerHtml: string;

  /** HTML rendered as the main receipt body. Fee + payment table. */
  @Column({ name: 'body_html', type: 'text', default: '' })
  bodyHtml: string;

  /** HTML rendered below the body. Signature, watermark, notes. */
  @Column({ name: 'footer_html', type: 'text', default: '' })
  footerHtml: string;

  /** Picked by the renderer when multiple templates match the same kind. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

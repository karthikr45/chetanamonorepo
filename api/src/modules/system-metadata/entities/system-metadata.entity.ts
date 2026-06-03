import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * System-level reference data curated by the super-admin and
 * available to every tenant as read-only metadata.
 *
 * Generic by design — a single table for any kind of dropdown:
 *   type='academic_year', value='2025-2026'
 *   type='class',         value='Inter 1Y'
 *   type='term',          value='1st Term Fee'
 *   type='payment_type',  value='POS'
 *   type='board_type',    value='CBSE'
 *
 * Tenant admins can read it (to populate dropdowns) but cannot
 * write — they keep their own per-tenant overrides where applicable
 * (e.g. tenants table for academic_years).
 *
 * `displayOrder` controls the order in dropdowns; lower = earlier.
 */
@Entity('system_metadata')
@Unique('uq_system_metadata_type_value', ['type', 'value'])
@Index('idx_system_metadata_type_active', ['type', 'isActive'])
export class SystemMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Kind of metadata. Free-form so new types don't require migrations. */
  @Column({ type: 'varchar', length: 50 })
  type: string;

  /** The canonical value (used as the dropdown's value AND label by default). */
  @Column({ type: 'varchar', length: 100 })
  value: string;

  /** Optional human-friendly label (defaults to `value` if null). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  label: string | null;

  /** Optional description shown as tooltip / help text in the UI. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Lower numbers appear first. */
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** Inactive entries are hidden from tenant dropdowns but kept for history. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

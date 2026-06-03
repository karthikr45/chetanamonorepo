import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * One row per student per academic year.
 * Class/section/roll-no change yearly, so the same admission number
 * appears in multiple rows across years.
 *
 * `schoolCode` identifies the institution. It is shared across the
 * sibling school/hostel/transport tenants, so (school_code +
 * admission_number) links one person's records across those tenants.
 *
 * Unique: (tenant_id, school_code, admission_number, academic_year)
 */
@Entity('students')
@Unique('uq_students_tenant_branch_admission_year', [
  'tenantId',
  'schoolCode',
  'admissionNumber',
  'academicYear',
])
@Index('idx_students_tenant_branch_year', [
  'tenantId',
  'schoolCode',
  'academicYear',
])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'school_code', type: 'varchar', length: 100 })
  schoolCode: string;

  @Column({ name: 'admission_number', type: 'varchar', length: 50 })
  admissionNumber: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 20 })
  academicYear: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 20 })
  class: string;

  @Column({ type: 'varchar', length: 10 })
  section: string;

  @Column({ name: 'roll_no', type: 'varchar', length: 20 })
  rollNo: string;

  @Column({ name: 'img_url', type: 'text', nullable: true })
  imgUrl: string | null;

  // ─── Transport (only set on transport-tenant rows) ───────────────
  // Editing pickup/drop is an admin action that may change the monthly
  // fee for not-yet-billed months.
  @Column({ name: 'pickup_location', type: 'varchar', length: 200, nullable: true })
  pickupLocation: string | null;

  @Column({ name: 'drop_location', type: 'varchar', length: 200, nullable: true })
  dropLocation: string | null;

  // ─── Particulars used on the Transfer Certificate ────────────────
  // Optional; auto-filled on the printed TC when present.
  @Column({ name: 'father_name', type: 'varchar', length: 150, nullable: true })
  fatherName: string | null;

  @Column({ name: 'mother_name', type: 'varchar', length: 150, nullable: true })
  motherName: string | null;

  @Column({ name: 'date_of_admission', type: 'date', nullable: true })
  dateOfAdmission: string | null;

  // ─── Identity ─────────────────────────────────────────────────────
  /**
   * Canonical identity of the person this row represents. Nullable
   * during migration — the backfill auto-creates one identity per
   * legacy row, then this column is effectively non-null in practice.
   * Every new admission must carry an identity_id.
   */
  @Column({ name: 'identity_id', type: 'uuid', nullable: true })
  @Index('idx_students_identity')
  identityId: string | null;

  // ─── Transfer Certificate (lifecycle close) ──────────────────────
  /**
   * Set when the school issues a TC for this enrollment. The row
   * stays in the DB (audit + historical receipts) but is filtered
   * out of active rosters by default.
   */
  @Column({ name: 'tc_issued_at', type: 'timestamptz', nullable: true })
  tcIssuedAt: Date | null;

  @Column({ name: 'tc_reason', type: 'varchar', length: 500, nullable: true })
  tcReason: string | null;

  @Column({ name: 'tc_certificate_no', type: 'varchar', length: 50, nullable: true })
  tcCertificateNo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
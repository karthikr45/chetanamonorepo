import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Canonical identity of a student person, decoupled from any one
 * admission number. A student can have many `students` rows over time
 * (one per continuous enrollment) but exactly one identity. When a
 * student gets a TC and rejoins, the school office reuses the same
 * identity — the new `students` row points to it.
 *
 * Indexed by phone + lowered email so the admission search ("is this
 * person already on record?") is fast.
 */
@Entity('student_identities')
@Index('idx_student_identities_tenant_phone', ['tenantId', 'primaryPhone'])
@Index('idx_student_identities_tenant_email', ['tenantId', 'primaryEmail'])
@Index('idx_student_identities_tenant_name', ['tenantId', 'displayName'])
export class StudentIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identities are tenant-scoped — each school's records stand alone. */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 150 })
  displayName: string;

  /** ISO date — date of birth. Nullable because legacy rows may lack it. */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string | null;

  /** Primary contact channels (parent's or student's). */
  @Column({ name: 'primary_phone', type: 'varchar', length: 20, nullable: true })
  primaryPhone: string | null;

  @Column({ name: 'primary_email', type: 'varchar', length: 150, nullable: true })
  primaryEmail: string | null;

  /** Optional headshot for the person view. */
  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  /** Free-text notes — admissions team's private memo about the person. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Parent } from './parent.entity';

export enum Relationship {
  FATHER = 'father',
  MOTHER = 'mother',
  GUARDIAN = 'guardian',
}

/**
 * Links a Parent to one of their children by admission_number (the
 * canonical student identity that doesn't change year-over-year).
 * The actual current-year Student row is resolved via
 * (tenant_id, branch, admission_number, current academic_year).
 */
@Entity('parent_students')
@Unique('uq_parent_students_link', [
  'parentId',
  'tenantId',
  'branch',
  'admissionNumber',
])
@Index('idx_parent_students_lookup', [
  'tenantId',
  'branch',
  'admissionNumber',
])
export class ParentStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parent, (p) => p.studentLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Parent;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  branch: string;

  @Column({ name: 'admission_number', type: 'varchar', length: 50 })
  admissionNumber: string;

  @Column({
    type: 'enum',
    enum: Relationship,
    default: Relationship.GUARDIAN,
  })
  relationship: Relationship;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

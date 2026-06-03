import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('academic_years')
// One row per (tenant, AY) — NOT globally unique. Multiple tenants
// can have the same AY value (e.g. every school has "2025-2026").
@Unique('uq_academic_years_tenant_year', ['tenantId', 'academicYear'])
export class AcademicYear {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 20 })
  academicYear: string;
 
  @Column({ name: 'is_current_year', type: 'boolean', default: false })
  isCurrentYear: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;
 
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
 
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
 
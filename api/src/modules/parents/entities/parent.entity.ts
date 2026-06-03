import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  OneToMany,
} from 'typeorm';
import { ParentStudent } from './parent-student.entity';

/**
 * Parent of one or more students. Email is unique within a tenant.
 * Authentication is OTP-based (see modules/parent-auth).
 */
@Entity('parents')
@Unique('uq_parents_tenant_email', ['tenantId', 'email'])
@Index('idx_parents_tenant', ['tenantId'])
export class Parent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true })
  refreshTokenHash: string | null;

  @OneToMany(() => ParentStudent, (link) => link.parent, { cascade: true })
  studentLinks: ParentStudent[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

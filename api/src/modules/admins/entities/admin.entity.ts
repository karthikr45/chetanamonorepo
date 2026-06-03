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

@Entity('admins')
// Same email can exist in multiple tenants, but not twice within the same
// tenant. Super-admins (tenantId NULL) are guarded at the service level
// because Postgres treats NULLs as distinct in unique constraints.
@Unique('uq_admin_email_tenant', ['email', 'tenantId'])
@Index('idx_admin_email', ['email'])
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  /**
   * Free-form role string. Built-ins are super_admin / admin / fin_admin /
   * ops_admin / parent (see Role enum); super-admin can also register custom
   * roles via system_metadata(type='admin_role') and assign them here.
   * Only the built-ins get special permissions; custom roles are labels.
   */
  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  secretKey: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash: string | null = null;

  // Hashed single-use password-reset token + its expiry. Null when no reset
  // is in flight. Cleared on successful reset.
  @Column({ type: 'varchar', nullable: true })
  passwordResetTokenHash: string | null = null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpiresAt: Date | null = null;

  // Email verification. Default false; sign-in only blocks on this when
  // AUTH_REQUIRE_EMAIL_VERIFICATION=true (so existing/seeded admins keep
  // working until an operator opts in).
  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationTokenHash: string | null = null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiresAt: Date | null = null;

  // Brute-force lockout. Reset on a successful sign-in.
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null = null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

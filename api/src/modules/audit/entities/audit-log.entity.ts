import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * System-wide activity trail: one row per mutating API call (who, what,
 * where, outcome). Schools get audited — "who changed this fee / who
 * deleted this student" must be answerable. Distinct from the
 * payment_audit_logs table, which is the deep gateway/state ledger.
 */
@Index(['tenantId', 'createdAt'])
@Index(['actorId'])
@Index(['method', 'path'])
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tenant scope of the actor. 'none' for unauthenticated/public calls. */
  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar' })
  method: string;

  /** Route path (params still substituted — the real URL that was hit). */
  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'boolean', default: false })
  isError: boolean;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  /** Sanitised request payload (secrets/tokens stripped). */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

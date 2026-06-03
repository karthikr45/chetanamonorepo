import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/** Tenant-scoped media library (photos for the school gallery/feed). */
@Index('idx_media_tenant_created', ['tenantId', 'createdAt'])
@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branch: string | null;

  @Column({ type: 'text' })
  url: string;

  /** Blob path within the tenant container — used for deletion. */
  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  caption: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

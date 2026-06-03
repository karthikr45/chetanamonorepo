// tenant-configuration.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum EnvironmentType {
  PRODUCTION = 'production',
  QA = 'qa',
  DEVELOPMENT = 'development',
}

export enum GatewayType {
  RAZORPAY = 'razorpay',
  CASHFREE = 'cashfree',
}

/**
 * Whether the configured gateway credentials are test/sandbox or live.
 * Independent of EnvironmentType — a tenant on the production app
 * environment can still pilot the gateway in test mode before going
 * live.
 */
export enum PaymentMode {
  TEST = 'test',
  PRODUCTION = 'production',
}

@Entity('tenant_configurations')
@Unique(['tenantId', 'configurationName'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'environmentType'])
export class TenantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // ─── General ─────────────────────────────────────────────

  @Column({ name: 'environment_type', type: 'enum', enum: EnvironmentType })
  environmentType: EnvironmentType;

  @Column({ name: 'configuration_name', type: 'varchar', length: 255 })
  configurationName: string;

  // ─── Domain Settings ──────────────────────────────────────

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'receipt_logo_url', type: 'text', nullable: true })
  receiptLogoUrl: string | null;

  @Column({ name: 'domain_url', type: 'text', nullable: true })
  domainUrl: string | null;

  // ─── Legal / Policy URLs (shown in the parent portal & public pay) ──

  @Column({ name: 'privacy_policy_url', type: 'text', nullable: true })
  privacyPolicyUrl: string | null;

  @Column({ name: 'terms_and_conditions_url', type: 'text', nullable: true })
  termsAndConditionsUrl: string | null;

  @Column({ name: 'refund_policy_url', type: 'text', nullable: true })
  refundPolicyUrl: string | null;

  // ─── File Storage ─────────────────────────────────────────

  @Column({ name: 'storage_access_key', type: 'text', nullable: true })
  accessKey: string | null;

  @Column({ name: 'storage_connection_string', type: 'text', nullable: true })
  storageConnectionString: string | null;

  @Column({
    name: 'storage_container_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  storageContainerName: string | null;

  @Column({ name: 'storage_secret_key', type: 'text', nullable: true })
  storageSecretKey: string | null;

  @Column({
    name: 'storage_bucket_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  storageBucketName: string | null;

  // ─── Payment Gateway ──────────────────────────────────────

  @Column({
    name: 'gateway_type',
    type: 'enum',
    enum: GatewayType,
    nullable: true,
  })
  gatewayType: GatewayType | null;

  @Column({ name: 'payment_client_id', type: 'text', nullable: true })
  paymentClientId: string | null;

  @Column({ name: 'payment_secret_key', type: 'text', nullable: true })
  paymentSecretKey: string | null;

  @Column({
    name: 'payment_mode',
    type: 'enum',
    enum: PaymentMode,
    default: PaymentMode.TEST,
  })
  paymentMode: PaymentMode;

  @Column({ name: 'payment_webhook_url', type: 'text', nullable: true })
  paymentWebhookUrl: string | null;

  // ─── SMTP ─────────────────────────────────────────────────

  @Column({ name: 'smtp_host', type: 'varchar', length: 255, nullable: true })
  smtpHost: string | null;

  @Column({ name: 'smtp_port', type: 'int', nullable: true })
  smtpPort: number | null;

  @Column({ name: 'smtp_user', type: 'varchar', length: 255, nullable: true })
  smtpUser: string | null;

  @Column({ name: 'smtp_password', type: 'text', nullable: true })
  smtpPassword: string | null;

  @Column({
    name: 'smtp_from_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  smtpFromName: string | null;

  @Column({
    name: 'smtp_from_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  smtpFromEmail: string | null;

  @Column({
    name: 'smtp_secure',
    type: 'boolean',
    nullable: true,
    default: true,
  })
  smtpSecure: boolean | null;

  // ─── Metadata ─────────────────────────────────────────────

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}






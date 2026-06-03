import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EnvironmentType,
  GatewayType,
  PaymentMode,
} from '../entities/tenant-config.entity';

/** Maps empty / placeholder values to undefined so @IsOptional() skips @IsEnum. */
const optionalEnum = <T extends Record<string, string>>(enumObj: T) =>
  Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    const normalized =
      typeof value === 'string' ? value.toLowerCase().trim() : value;
    if (normalized === '' || typeof normalized !== 'string') return undefined;
    const allowed = new Set(
      Object.values(enumObj).filter((v): v is string => typeof v === 'string'),
    );
    return allowed.has(normalized) ? (normalized as T[keyof T]) : undefined;
  });

export class CreateTenantConfigDto {
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  // ─── General ─────────────────────────────────────────────

  @optionalEnum(EnvironmentType)
  @IsEnum(EnvironmentType)
  @IsOptional()
  envType?: EnvironmentType;

  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsString()
  @IsOptional()
  @MaxLength(255)
  configName?: string;

  // ─── Domain Settings ──────────────────────────────────────

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  receiptLogoUrl?: string;

  @IsString()
  @IsOptional()
  domainUrl?: string;

  // ─── File Storage ─────────────────────────────────────────

  @IsString()
  @IsOptional()
  accessKey?: string;

  @IsString()
  @IsOptional()
  connectionString?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  containerName?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  secretKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  bucketName?: string;

  @IsString()
  @IsOptional()
  storageTab?: string;

  // ─── Payment Gateway ──────────────────────────────────────

  @optionalEnum(GatewayType)
  @IsEnum(GatewayType)
  @IsOptional()
  gatewayType?: GatewayType;

  @IsString()
  @IsOptional()
  paymentKey?: string;

  @IsString()
  @IsOptional()
  paymentSecret?: string;

  @optionalEnum(PaymentMode)
  @IsEnum(PaymentMode)
  @IsOptional()
  paymentMode?: PaymentMode;

  @IsString()
  @IsOptional()
  webhookUrl?: string;

  // ─── SMTP ─────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  smtpHost?: string;

  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  @IsInt()
  @IsOptional()
  smtpPort?: number;

  @IsString()
  @IsOptional()
  smtpUser?: string;

  @IsString()
  @IsOptional()
  smtpPassword?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  smtpFromName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  smtpFromEmail?: string;

  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  smtpSecure?: boolean;
}

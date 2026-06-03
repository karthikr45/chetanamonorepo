import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptResetPolicy } from '../entities/tenant.entity';
import {
  BILLING_MODES,
  SCHOOL_CODE_REGEX,
  TENANT_CODE_REGEX,
} from '../../../common/constants/tenant';

export class CreateTenantDto {
  @ApiProperty({ example: 'Sunrise High School' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'SHS001' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({
    example: 'SVBK-BRD',
    description:
      'Unique tenant code. Uppercase letters/digits/hyphens, 2–31 chars, must start with a letter.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(TENANT_CODE_REGEX, {
    message:
      'tenantCode must be uppercase letters/digits/hyphens, 2–31 chars, starting with a letter',
  })
  tenantCode: string;

  @ApiProperty({ example: 'Sunrise Tenant' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional({
    example: 'School',
    description: 'Tenant type — School / Hostel / Transport.',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    example: 'SVBK-BRD',
    description:
      'School code this tenant belongs to. Sibling school/hostel/' +
      'transport tenants for one campus share the same school code.',
  })
  @IsString()
  @IsOptional()
  @Matches(SCHOOL_CODE_REGEX, {
    message:
      'schoolCode must be uppercase letters/digits/hyphens, 2–31 chars, starting with a letter',
  })
  schoolCode?: string;

  @ApiPropertyOptional({
    example: 'term_wise',
    description:
      'Billing mode (a billing_mode metadata value: term_wise | monthly). ' +
      'When omitted, derived from type — transport is monthly, others term-wise.',
  })
  @IsOptional()
  @IsIn(BILLING_MODES, {
    message: `billingMode must be one of: ${BILLING_MODES.join(', ')}`,
  })
  billingMode?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Per-tenant monetization gate. Off today; flip on once the ' +
      'subscription/invoice flow is built. Super-admin only.',
  })
  @IsOptional()
  @IsBoolean()
  monetizationEnabled?: boolean;

  @ApiPropertyOptional({ example: 'State Board' })
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Hyderabad' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Telangana' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: 'SVBK',
    description:
      'Short prefix shown on every receipt issued for this tenant ' +
      '(letters / digits only). Defaults to the tenant code if omitted.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  receiptPrefix?: string;

  @ApiPropertyOptional({
    enum: ReceiptResetPolicy,
    example: ReceiptResetPolicy.ACADEMIC_YEAR,
    description:
      'How often the receipt sequence rolls back to the start number. ' +
      'Default is ACADEMIC_YEAR (most Indian schools).',
  })
  @IsEnum(ReceiptResetPolicy)
  @IsOptional()
  receiptResetPolicy?: ReceiptResetPolicy;

  @ApiPropertyOptional({
    example: 1,
    description: 'First receipt number to issue in any fresh period.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  receiptStartNumber?: number;
}

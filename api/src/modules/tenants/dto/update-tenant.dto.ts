import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptResetPolicy } from '../entities/tenant.entity';
import {
  BILLING_MODES,
  SCHOOL_CODE_REGEX,
  TENANT_CODE_REGEX,
} from '../../../common/constants/tenant';

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(TENANT_CODE_REGEX, {
    message:
      'tenantCode must be uppercase letters/digits/hyphens, 2–31 chars, starting with a letter',
  })
  tenantCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'School code this tenant belongs to.',
  })
  @IsString()
  @IsOptional()
  @Matches(SCHOOL_CODE_REGEX, {
    message:
      'schoolCode must be uppercase letters/digits/hyphens, 2–31 chars, starting with a letter',
  })
  schoolCode?: string;

  @ApiPropertyOptional({
    description:
      'Billing mode (billing_mode metadata value: term_wise | monthly).',
  })
  @IsOptional()
  @IsIn(BILLING_MODES, {
    message: `billingMode must be one of: ${BILLING_MODES.join(', ')}`,
  })
  billingMode?: string;

  @ApiPropertyOptional({
    description: 'Per-tenant monetization gate. Super-admin only.',
  })
  @IsOptional()
  @IsBoolean()
  monetizationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Short prefix shown on receipts.' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  receiptPrefix?: string;

  @ApiPropertyOptional({ enum: ReceiptResetPolicy })
  @IsEnum(ReceiptResetPolicy)
  @IsOptional()
  receiptResetPolicy?: ReceiptResetPolicy;

  @ApiPropertyOptional({ description: 'First number issued in any fresh period.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  receiptStartNumber?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

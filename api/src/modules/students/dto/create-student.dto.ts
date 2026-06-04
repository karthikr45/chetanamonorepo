import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TermType, MonthType } from '../../fees/entities/fee.entity';
import {
  SCHOOL_CODE_REGEX,
  SCHOOL_CODE_MESSAGE,
} from '../../../common/constants/tenant';

export class CreateStudentTermDto {
  @ApiProperty({ enum: TermType, example: TermType.FIRST })
  @IsEnum(TermType)
  term: TermType;

  @ApiProperty({ example: 25000, description: 'Original term fee (rupees)' })
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 0, description: 'Concession (rupees)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;
}

/**
 * One academic-year month's bill for a monthly (transport) tenant. Each
 * month carries its own fee, concession and — for transport — boarding /
 * drop point, so all three can vary month-wise.
 */
export class CreateStudentMonthDto {
  @ApiProperty({ enum: MonthType, example: MonthType.APRIL })
  @IsEnum(MonthType)
  month: MonthType;

  @ApiProperty({ example: 3000, description: 'This month\'s fee (rupees)' })
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 0, description: 'This month\'s concession (rupees)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 'Kukatpally Bus Stop', description: 'This month\'s boarding point (transport).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string | null;

  @ApiPropertyOptional({ example: 'School Gate', description: 'This month\'s drop point (transport).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropLocation?: string | null;
}

export class CreateStudentDto {
  @ApiPropertyOptional({
    description:
      'School code this student belongs to. Required in the body when creating a single student.',
    pattern: SCHOOL_CODE_REGEX.source,
    example: 'SVBK-BRD',
  })
  @IsOptional()
  @IsString()
  @Matches(SCHOOL_CODE_REGEX, { message: `schoolCode ${SCHOOL_CODE_MESSAGE}` })
  schoolCode?: string;

  @ApiProperty({ example: '2025-2026' })
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, { message: 'academicYear must be YYYY-YYYY' })
  academicYear: string;

  @ApiProperty({ example: 'ADM-2024-001' })
  @IsString()
  @IsNotEmpty()
  admissionNumber: string;

  @ApiProperty({ example: 'Arjun Kumar' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'arjun@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+91-9876543210' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: '7' })
  @IsString()
  @IsNotEmpty()
  class: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  rollNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imgUrl?: string | null;

  // ─── Transport (monthly-billing) fields ───────────────────────────
  @ApiPropertyOptional({ example: 'Kukatpally Bus Stop', description: 'Transport boarding point.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string | null;

  @ApiPropertyOptional({ example: 'School Gate', description: 'Transport drop point.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropLocation?: string | null;

  @ApiPropertyOptional({
    example: 3000,
    description:
      'Flat monthly fee (transport / monthly-billing tenants). When set, one ' +
      'fee is created for every month of the academic year (Apr–Mar). Prefer ' +
      '`months` for per-month amounts / boarding points.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: 0, description: 'Monthly concession (rupees).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyDiscount?: number;

  @ApiPropertyOptional({
    type: [CreateStudentMonthDto],
    description:
      'Per-month bills (transport / monthly tenants). One entry per ' +
      'academic-year month the student is billed for. Each carries its own ' +
      'amount, discount and boarding/drop point. Takes precedence over ' +
      '`monthlyFee`.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentMonthDto)
  months?: CreateStudentMonthDto[];

  @ApiPropertyOptional({
    description:
      'Existing person identity to attach this enrollment to. Used when ' +
      'admitting a returning student who has a TC\'d enrollment already on ' +
      'record. Omit to auto-create a new identity from name/email/phone.',
  })
  @IsOptional()
  @IsString()
  identityId?: string;

  @ApiPropertyOptional({
    type: [CreateStudentTermDto],
    description: 'Up to 5 terms (one per term). Discount defaults to 0.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentTermDto)
  terms?: CreateStudentTermDto[];
}

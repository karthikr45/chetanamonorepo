import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { TermType } from '../../fees/entities/fee.entity';
import { PenaltyAmountType } from '../entities/penalty-rule.entity';

export class CreatePenaltyRuleDto {
  @ApiPropertyOptional({ example: '2025-2026' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, { message: 'academicYear must be YYYY-YYYY' })
  academicYear?: string;

  @ApiPropertyOptional({ enum: TermType })
  @IsOptional()
  @IsEnum(TermType)
  term?: TermType;

  @ApiProperty({ example: 15, description: 'Days after fee due-date before this rule fires' })
  @IsInt()
  @Min(0)
  triggerAfterDays: number;

  @ApiProperty({ enum: PenaltyAmountType })
  @IsEnum(PenaltyAmountType)
  amountType: PenaltyAmountType;

  @ApiProperty({ example: 100, description: 'Amount in rupees' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 1500, description: 'Optional cap for PER_DAY rules' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Standard late fee policy 2025-26' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class UpdatePenaltyRuleDto extends CreatePenaltyRuleDto {}

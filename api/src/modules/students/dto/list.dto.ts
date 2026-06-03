import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;

/**
 * Filters for `GET /students`. Scope is taken from the JWT (tenant)
 * so clients can't widen it.
 */
export class ListStudentsQueryDto {
  @ApiPropertyOptional({ example: '2026-2027' })
  @IsOptional()
  @IsString({ message: 'academicYear must be a string' })
  @MaxLength(20, { message: 'academicYear must be 20 characters or fewer' })
  @Matches(ACADEMIC_YEAR_REGEX, {
    message: 'academicYear must be in the format YYYY-YYYY (e.g. 2026-2027)',
  })
  academicYear?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString({ message: 'class must be a string' })
  @MaxLength(20, { message: 'class must be 20 characters or fewer' })
  class?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString({ message: 'section must be a string' })
  @MaxLength(10, { message: 'section must be 10 characters or fewer' })
  section?: string;

  /** Free-text search across name + admission number. */
  @ApiPropertyOptional({ example: 'stephen' })
  @IsOptional()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must be 100 characters or fewer' })
  search?: string;

  /**
   * TC lifecycle filter for the Transfer Certificate register.
   * `active` = on roster (no TC), `tc_issued` = TC'd, `all` (default).
   */
  @ApiPropertyOptional({ enum: ['active', 'tc_issued', 'all'] })
  @IsOptional()
  @IsIn(['active', 'tc_issued', 'all'], {
    message: 'tcStatus must be active, tc_issued, or all',
  })
  tcStatus?: 'active' | 'tc_issued' | 'all';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be 1 or greater' })
  page?: number;

  @ApiPropertyOptional({ example: 25, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be 1 or greater' })
  @Max(100, { message: 'pageSize must be 100 or fewer' })
  pageSize?: number;
}

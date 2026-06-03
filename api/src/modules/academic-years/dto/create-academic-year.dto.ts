import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
} from 'class-validator';
 
export class CreateAcademicYearDto {
  @ApiProperty({
    example: '2026-2027',
    description: 'Academic year in YYYY-YYYY format (end year must be start + 1)',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must be in YYYY-YYYY format (e.g. 2026-2027)',
  })
  academicYear: string;
 
  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCurrentYear?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
 
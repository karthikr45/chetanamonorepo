import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateSystemMetadataDto {
  @ApiProperty({ example: 'academic_year' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  type: string;

  @ApiProperty({ example: '2025-2026' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 150)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSystemMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 150)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

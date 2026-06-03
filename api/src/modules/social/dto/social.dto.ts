import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPostKind } from '../entities/social-post.entity';

export class SocialImageDto {
  @ApiProperty({ description: 'Image data URI (data:image/...;base64,...) or URL' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;
}

export class CreateSocialPostDto {
  @ApiProperty({ example: 'Annual Day 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: SocialPostKind, default: SocialPostKind.POST })
  @IsOptional()
  @IsEnum(SocialPostKind)
  kind?: SocialPostKind;

  @ApiPropertyOptional({ example: 'A glittering evening with the SVBK family' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Event date (ISO). EVENT kind only.' })
  @IsOptional()
  @IsDateString()
  eventAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tags' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tags?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: [SocialImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SocialImageDto)
  images?: SocialImageDto[];
}

export class UpdateSocialPostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: SocialPostKind })
  @IsOptional()
  @IsEnum(SocialPostKind)
  kind?: SocialPostKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: [SocialImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SocialImageDto)
  images?: SocialImageDto[];
}

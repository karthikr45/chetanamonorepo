import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Sports Day on Saturday', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'Annual Sports Day will be held in the main ground at 9am.',
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    example: '2026-06-14T09:00:00.000Z',
    description: 'When the event takes place (ISO 8601).',
  })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({
    example: 'parent',
    description:
      'Who should see it. Omit (or null) to broadcast to everyone in the tenant.',
  })
  @IsOptional()
  @IsString()
  audienceRole?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, publish immediately and notify the audience. ' +
      'When false (default), the row is created as a draft — call ' +
      'POST /announcements/:id/publish later to send notifications.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

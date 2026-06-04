import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Legacy "edit student" payload coming from older frontend screens.
 * We accept the shape but still enforce server-side rules:
 * - admissionNumber is ignored (identity key; not editable)
 * - termFees is handled by the fees module logic
 */
export class UpdateStudentWithFeesDto {
  @ApiPropertyOptional({ example: 'Stephen', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: '1', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  class?: string;

  @ApiPropertyOptional({ example: 'A', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @ApiPropertyOptional({ example: '21', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rollNo?: string;

  // legacy field name used by frontend
  @ApiPropertyOptional({ example: '9879879879' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'stephen111.ross@gmail.com', maxLength: 150 })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    example: '11',
    description: 'Identity field; accepted but ignored on update.',
  })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional({ example: 'Kukatpally Bus Stop', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string;

  @ApiPropertyOptional({ example: 'School Gate', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropLocation?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Term-wise fee edits from frontend. Keys like "1st Term Fee", "2nd Term Fee".',
  })
  @IsOptional()
  @IsObject()
  termFees?: Record<string, any>;
}


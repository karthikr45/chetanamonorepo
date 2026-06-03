import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Used internally by the upload flow. Not exposed via HTTP. */
export interface UpsertStudentInput {
  tenantId: string;
  schoolCode: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  email: string;
  phoneNumber: string;
  class: string;
  section: string;
  rollNo: string;
  imgUrl: string | null;
  pickupLocation?: string | null;
  dropLocation?: string | null;
}

export interface UpsertStudentsResult {
  created: number;
  updated: number;
  /** keyed by `${admissionNumber}::${academicYear}` → student.id */
  idByKey: Map<string, string>;
}

/**
 * PATCH body for editing a single student. Every field is optional —
 * client sends only what they want to change.
 *
 * Fields we DON'T allow editing:
 *  - admissionNumber, academicYear, tenantId, schoolCode: identity keys,
 *    changing these would move the student to a different record.
 *  - id, created_at, updated_at: managed by the DB.
 */
export class UpdateStudentDto {
  @ApiPropertyOptional({ example: 'Arjun Kumar', maxLength: 150 })
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name cannot be empty' })
  @MaxLength(150, { message: 'name must be 150 characters or fewer' })
  name?: string;

  @ApiPropertyOptional({ example: 'arjun@example.com', maxLength: 150 })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(150, { message: 'email must be 150 characters or fewer' })
  email?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: '7–15 digits with optional leading +',
  })
  @IsOptional()
  @IsString({ message: 'phoneNumber must be a string' })
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phoneNumber must be 7–15 digits with an optional leading +',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '5', maxLength: 20 })
  @IsOptional()
  @IsString({ message: 'class must be a string' })
  @MinLength(1, { message: 'class cannot be empty' })
  @MaxLength(20, { message: 'class must be 20 characters or fewer' })
  class?: string;

  @ApiPropertyOptional({ example: 'A', maxLength: 10 })
  @IsOptional()
  @IsString({ message: 'section must be a string' })
  @MinLength(1, { message: 'section cannot be empty' })
  @MaxLength(10, { message: 'section must be 10 characters or fewer' })
  section?: string;

  @ApiPropertyOptional({ example: '12', maxLength: 20 })
  @IsOptional()
  @IsString({ message: 'rollNo must be a string' })
  @MinLength(1, { message: 'rollNo cannot be empty' })
  @MaxLength(20, { message: 'rollNo must be 20 characters or fewer' })
  rollNo?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/u/123.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imgUrl must be a valid URL' })
  @MaxLength(2048, { message: 'imgUrl must be 2048 characters or fewer' })
  imgUrl?: string;
}

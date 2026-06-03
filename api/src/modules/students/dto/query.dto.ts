import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;

/**
 * Query params for `GET /students/:id/with-fees`.
 *
 * The student ID in the path identifies ONE (student, year) record
 * directly — but the admin UI typically knows the admission number and
 * wants to see the full picture for a given year, so we also expose a
 * second endpoint keyed by admission number. See the controller.
 *
 * Note: tenant comes from the JWT — no client-supplied scope.
 */
export class AcademicYearQueryDto {
  @ApiProperty({ example: '2026-2027', description: 'Academic year in YYYY-YYYY format' })
  @IsString({ message: 'academicYear must be a string' })
  @IsNotEmpty({ message: 'academicYear query param is required' })
  @MaxLength(20, { message: 'academicYear must be 20 characters or fewer' })
  @Matches(ACADEMIC_YEAR_REGEX, {
    message: 'academicYear must be in the format YYYY-YYYY (e.g. 2026-2027)',
  })
  academicYear: string;
}

export class StudentByAdmissionQueryDto extends AcademicYearQueryDto {
  @ApiProperty({ example: 'ADM-2025-001', description: 'Admission number of the student' })
  @IsString({ message: 'admissionNumber must be a string' })
  @IsNotEmpty({ message: 'admissionNumber query param is required' })
  @MaxLength(50, { message: 'admissionNumber must be 50 characters or fewer' })
  admissionNumber: string;
}

import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StudentFeesService } from '../fees/student-fees.service';
import { StudentsService } from './students.service';

@ApiTags('studentsDetails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('studentsDetails')
export class StudentsDetailsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentFeesService: StudentFeesService,
  ) {}

  /**
   * Backward-compatible endpoint for older frontend clients.
   * Maps `admission` -> `admissionNumber` used by students module APIs.
   */
  @Get('getStudentDetailsByAdmission')
  @ApiOperation({ summary: 'Get student details by admission (legacy route)' })
  async getStudentDetailsByAdmission(
    @Query('admission') admission: string,
    @Query('academicYear') academicYear: string,
    @Req() req: Request,
  ) {
    if (!admission?.trim()) {
      throw new BadRequestException('admission query param is required');
    }
    if (!academicYear?.trim()) {
      throw new BadRequestException('academicYear query param is required');
    }

    const { tenantId } = ctx(req);
    const student = await this.studentsService.findByAdmissionYear(
      tenantId,
      '',
      admission.trim(),
      academicYear.trim(),
    );
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }
}

interface AuthContext {
  tenantId: string;
  userId: string;
}

function ctx(req: Request): AuthContext {
  const user = (req as any).user;
  if (!user?.tenantId || !user?.userId) {
    throw new BadRequestException('Authentication required');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
  };
}

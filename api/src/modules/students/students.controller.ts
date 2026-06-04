import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { StudentsService } from './students.service';
import { UploadService } from './upload.service';
import { StudentFeesService } from '../fees/student-fees.service';
import { UpdateStudentDto } from './dto/student.dto';
import { UpdateStudentWithFeesDto } from './dto/update-student-with-fees.dto';
import {
  AcademicYearQueryDto,
  StudentByAdmissionQueryDto,
} from './dto/query.dto';
import {
  ValidateUploadResponseDto,
  ConfirmUploadResponseDto,
} from './dto/upload.dto';
import { ListStudentsQueryDto } from './dto/list.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import {
  COLUMN_DESCRIPTIONS,
  COLUMN_DESCRIPTIONS_MONTHLY,
  MONTHLY_FEE_COLUMNS,
  SAMPLE_ROWS_MONTHLY,
  TRANSPORT_COLUMNS,
  EXCEL_COLUMNS,
  MAX_UPLOAD_SIZE_BYTES,
  REQUIRED_STUDENT_COLUMNS,
  SAMPLE_ROWS,
  TERM_DEFINITIONS,
} from './constants/excel.constants';
import { resolveBillingContext } from './utils/row-validator.util';
import { BILLING_MODE } from '../../common/constants/tenant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import * as XLSX from 'xlsx';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeesService } from '../fees/fees.service';
import { PaymentType } from '../fees/entities/fee-payment.entity';
import { TermType } from '../fees/entities/fee.entity';



@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly uploadService: UploadService,
    private readonly studentFeesService: StudentFeesService,
    private readonly feesService: FeesService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  // ─────────────── Single create ───────────────

  @Post()
  @ApiOperation({
    summary: 'Create one student (with optional term fees)',
    description:
      'Creates one Student row for (tenant, schoolCode, admissionNumber, academicYear) and optionally a Fee row per term passed in the body.',
  })
  async createOne(@Body() dto: CreateStudentDto, @Req() req: Request) {
    const { tenantId } = ctx(req);
    const schoolCode = (dto.schoolCode ?? '').trim();
    if (!schoolCode) {
      throw new BadRequestException('schoolCode is required in the body');
    }
    return this.uploadService.createOne(tenantId, schoolCode, dto);
  }

  // ─────────────── Upload ───────────────

  @Get('upload/template')
  @ApiOperation({
    summary: 'Download the bulk-upload template (Excel or CSV)',
    description:
      'Returns the canonical column headers + several realistic sample rows. ' +
      'Open in Excel/Sheets, replace the samples with your data, save as .xlsx ' +
      '(or .csv), then upload via /students/upload/validate → /students/upload/confirm. ' +
      'Excel format additionally includes an "Instructions" sheet with per-column help.\n\n' +
      'Query: ?format=csv to get a CSV (default is xlsx).',
  })
  async downloadTemplate(
    @Req() req: Request,
    @Query('format') format?: 'xlsx' | 'csv',
  ) {
    // The template shape follows the tenant's billing mode: term-wise
    // tenants get the term columns; monthly tenants (e.g. transport) get
    // a single Monthly Fee, plus pickup/drop for transport.
    const { tenantId } = ctx(req);
    const tenant = tenantId
      ? await this.tenantRepo.findOne({ where: { id: tenantId } })
      : null;

    const code = tenant?.code ?? 'your-school-code';
    const billing = resolveBillingContext(tenant?.type, tenant?.billingMode);

    const feeColumns =
      billing.billingMode === BILLING_MODE.MONTHLY
        ? [
            ...MONTHLY_FEE_COLUMNS,
            ...(billing.isTransport ? TRANSPORT_COLUMNS : []),
          ]
        : TERM_DEFINITIONS.flatMap((t) => [t.feeCol, t.discountCol]);

    const headers: string[] = [
      ...REQUIRED_STUDENT_COLUMNS,
      EXCEL_COLUMNS.IMG_URL,
      ...feeColumns,
    ];

    const sampleRows =
      (
        billing.billingMode === BILLING_MODE.MONTHLY ? SAMPLE_ROWS_MONTHLY : SAMPLE_ROWS
      ).map(row => ({
        ...row,
        "Code": code,
      }));
 

    const descriptions = (
      billing.billingMode === BILLING_MODE.MONTHLY
        ? COLUMN_DESCRIPTIONS_MONTHLY
        : COLUMN_DESCRIPTIONS
    ).filter((d) => headers.includes(d.column));

    const studentsSheet = XLSX.utils.json_to_sheet(sampleRows, {
      header: headers,
    });
    (studentsSheet as any)['!cols'] = headers.map((h) => ({
      wch: Math.max(14, h.length + 2),
    }));

    const res = (req as any).res;

    if ((format ?? 'xlsx') === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(studentsSheet);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="svbk-students-upload-template.csv"',
      );
      // Prepend BOM so Excel opens UTF-8 correctly
      res.send('﻿' + csv);
      return;
    }

    // Excel: include a second "Instructions" sheet with per-column help
    const instructionsSheet = XLSX.utils.json_to_sheet(descriptions, {
      header: ['column', 'required', 'example', 'notes'],
    });
    (instructionsSheet as any)['!cols'] = [
      { wch: 24 }, // column
      { wch: 10 }, // required
      { wch: 22 }, // example
      { wch: 70 }, // notes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, studentsSheet, 'Students');
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="svbk-students-upload-template.xlsx"',
    );
    res.send(buf);
  }

  @Post('upload/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate Excel upload',
    description:
      'Parses the uploaded .xlsx/.csv and validates every row. No DB writes.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx) or CSV file',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validateUpload(
    @UploadedFile(buildFilePipe()) file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<ValidateUploadResponseDto> {
    const { tenantId } = ctx(req);
    return this.uploadService.validateFile(file.buffer, tenantId);
  }

  @Post('upload/confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm and save Excel upload',
    description:
      'Re-validates the file server-side and persists atomically.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx) or CSV file',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async confirmUpload(
    @UploadedFile(buildFilePipe()) file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<ConfirmUploadResponseDto> {
    const { tenantId } = ctx(req);
    return this.uploadService.confirmUpload(file.buffer, tenantId);
  }

  // ─────────────── Student read / edit ───────────────

  @Get()
  @ApiOperation({
    summary: 'List students with fees',
    description:
      'Paginated list of students for the tenant, each enriched with their fees (and payment history) for the student\'s academic year. Filter by academic year, class, section, or free-text search on name/admission. Scoped to the caller\'s tenant — students carry the tenant\'s code (tenantCode) as their schoolCode.',
  })
  async list(
    @Query() query: ListStudentsQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    // Students are scoped by the tenant's code (student.schoolCode holds the
    // tenant's tenantCode).
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const result = await this.studentsService.list(tenantId, {
      ...query,
      schoolCode: tenant?.tenantCode ?? undefined,
    });

    const feesByStudent = await this.studentFeesService.getFeesForStudents(
      tenantId,
      result.items.map((s) => ({
        studentId: s.id,
        academicYear: s.academicYear,
      })),
    );
    return {
      ...result,
      items: result.items.map((s) => ({
        ...s,
        fees: feesByStudent.get(s.id) ?? [],
      })),
    };
  }

  @Get('by-admission/with-fees')
  @ApiOperation({
    summary: 'Get student + fees by admission number',
    description: 'Students are scoped by the tenant code.',
  })
  async getByAdmissionWithFees(
    @Query() query: StudentByAdmissionQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    // Students are scoped by the tenant's code (student.schoolCode holds the
    // tenant's tenantCode).
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const student = await this.studentsService.findByAdmissionYear(
      tenantId,
      tenant?.tenantCode ?? '',
      query.admissionNumber,
      query.academicYear,
    );
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Get('latest')
  @ApiOperation({
    summary: 'Get latest 5 students',
    description: 'Returns the 5 most recently created students for the tenant, ordered by creation date descending.',
  })
  async getLatest(@Req() req: Request) {
    const { tenantId } = ctx(req);
    return this.studentsService.getLatest(tenantId);
  }

  @Get(':id/services')
  @ApiOperation({
    summary:
      "A person's school/hostel/transport fees across sibling tenants",
    description:
      'Resolves the student in your tenant, then aggregates every ' +
      'enrollment that shares its school code + admission number across ' +
      'the sibling school/hostel/transport tenants, each with its fees. ' +
      'Defaults to the student\'s academic year.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  async servicesForStudent(
    @Param('id', buildUuidPipe('id')) id: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const student = await this.studentsService.findOneOrFail(tenantId, id);
    return this.studentsService.getServicesForPerson(
      student.schoolCode,
      student.admissionNumber,
      student.academicYear,
    );
  }

  @Get(':id/with-fees')
  @ApiOperation({ summary: 'Get student + fees by UUID' })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async getWithFees(
    @Param('id', buildUuidPipe('id')) id: string,
    @Query() query: AcademicYearQueryDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const student = await this.studentsService.findOneOrFail(tenantId, id);
    if (student.academicYear !== query.academicYear) {
      throw new BadRequestException(
        `Student's academic year is ${student.academicYear}, not ${query.academicYear}`,
      );
    }
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student profile by UUID' })
  @ApiParam({
    name: 'id',
    description: 'Student UUID',
    example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f',
  })
  async getOne(
    @Param('id', buildUuidPipe('id')) id: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const student = await this.studentsService.findOneOrFail(tenantId, id);
    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      student.id,
      student.academicYear,
    );
    return { student, fees };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update student profile',
    description:
      'Partial update. Identity fields (admission_number, academic_year, tenant, branch_code) cannot be changed.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async patchUpdate(
    @Param('id', buildUuidPipe('id')) id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.studentsService.update(tenantId, id, dto);
  }

  @Post(':id/issue-tc')
  @ApiOperation({
    summary: 'Mark TC issued on this enrollment',
    description:
      'Stamps tc_issued_at/reason/certificate_no on the row. Active rosters filter ' +
      'out TC\'d enrollments by default. Existing fee/payment/receipt history is preserved.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  async issueTc(
    @Param('id', buildUuidPipe('id')) id: string,
    @Body() body: { reason?: string; certificateNo?: string; issuedAt?: string },
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.studentsService.issueTc(tenantId, id, body ?? {});
  }

  @Post(':id/revoke-tc')
  @ApiOperation({
    summary: 'Revoke a previously-issued TC (clears the three TC fields)',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  async revokeTc(
    @Param('id', buildUuidPipe('id')) id: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    return this.studentsService.revokeTc(tenantId, id);
  }

  @Get(':id/tc-certificate')
  @ApiOperation({
    summary: 'Printable Transfer Certificate (HTML, A4)',
    description:
      'Returns a printable TC document for an enrollment that already has '
      + 'a TC issued. Open in a new tab and use the browser print dialog.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  async tcCertificate(
    @Param('id', buildUuidPipe('id')) id: string,
    @Req() req: Request,
  ) {
    const { tenantId } = ctx(req);
    const html = await this.studentsService.renderTcCertificate(tenantId, id);
    const res = (req as any).res;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('by-admission/enrollments')
  @ApiOperation({
    summary: 'List every enrollment row for the person who owns this admission number',
    description:
      'Walks via identity_id. Returns the full timeline of that student\'s stays at ' +
      'this school, newest first. Returns the single row when the student has no ' +
      'identity link yet (legacy data).',
  })
  async listEnrollmentsByAdmission(
    @Query('admissionNumber') admissionNumber: string,
    @Req() req: Request,
  ) {
    if (!admissionNumber?.trim()) {
      return { admissionNumber: '', enrollments: [] };
    }
    const { tenantId } = ctx(req);
    const enrollments = await this.studentsService.listEnrollmentsByAdmission(
      tenantId,
      admissionNumber.trim(),
    );
    return { admissionNumber, enrollments };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update student + fees (legacy payload)',
    description:
      'Accepts older frontend payload shape (phone, admissionNumber, termFees). admissionNumber is ignored. Student fields update and additional payments are recorded against matching term fees.',
  })
  @ApiParam({ name: 'id', description: 'Student UUID', example: 'd6f2e8a0-1c5b-4f2a-9c3b-2e8a6f1c5b4f' })
  async putUpdateLegacy(
    @Param('id', buildUuidPipe('id')) id: string,
    @Body() dto: UpdateStudentWithFeesDto,
    @Req() req: Request,
  ) {
    const { tenantId, userId } = ctx(req);

    // Update student profile (map legacy phone -> phoneNumber). Ignore admissionNumber.
    const studentUpdate: UpdateStudentDto = {
      name: dto.name,
      class: dto.class,
      section: dto.section,
      rollNo: dto.rollNo,
      email: dto.email,
      phoneNumber: dto.phone,
      pickupLocation: dto.pickupLocation,
      dropLocation: dto.dropLocation,
    };
    const updatedStudent = await this.studentsService.update(
      tenantId,
      id,
      studentUpdate,
    );

    // Apply fee payment deltas (we only ever ADD payments; cannot reduce history).
    if (dto.termFees && Object.keys(dto.termFees).length) {
      const student = await this.studentsService.findOneOrFail(tenantId, id);
      const summaries = await this.studentFeesService.getFeesForStudent(
        tenantId,
        id,
        student.academicYear,
      );
      const byTerm = new Map<string, (typeof summaries)[number]>();
      for (const s of summaries) byTerm.set(s.term, s);

      for (const [termKey, raw] of Object.entries(dto.termFees)) {
        if (!Object.values(TermType).includes(termKey as TermType)) continue;
        const summary = byTerm.get(termKey);
        if (!summary) continue;

        const desiredPaidRaw =
          raw?.paidAmount ?? raw?.feePaid ?? raw?.amountPaid ?? null;
        const desiredPaid =
          desiredPaidRaw === null || desiredPaidRaw === undefined
            ? NaN
            : Number(desiredPaidRaw);
        if (!Number.isFinite(desiredPaid) || desiredPaid < 0) continue;

        const currentPaid = Number(summary.paidAmount);
        const delta = desiredPaid - currentPaid;
        if (delta < -0.01) {
          throw new BadRequestException(
            `Cannot reduce paid amount for "${termKey}". Current=${currentPaid}, requested=${desiredPaid}`,
          );
        }
        if (delta <= 0.01) continue;

        const paymentType = mapPaymentType(raw?.paymentType);
        const paidAt = raw?.paymentDate ?? raw?.receiptDate ?? raw?.paidAt;
        const bankName = raw?.bankName;
        const ddNumber = raw?.ddNumber;

        await this.feesService.recordOfflinePayment(tenantId, summary.feeId, {
          amount: delta,
          paymentType,
          bankName: typeof bankName === 'string' ? bankName : undefined,
          paidAt: typeof paidAt === 'string' ? paidAt : undefined,
          ddNumber:
            paymentType === PaymentType.DD && typeof ddNumber === 'string'
              ? ddNumber
              : undefined,
          chequeNumber:
            paymentType === PaymentType.CHEQUE && typeof ddNumber === 'string'
              ? ddNumber
              : undefined,
          recordedBy: userId ?? null,
        });
      }
    }

    const fees = await this.studentFeesService.getFeesForStudent(
      tenantId,
      id,
      updatedStudent.academicYear,
    );
    return { student: updatedStudent, fees };
  }
}

function mapPaymentType(input: unknown): PaymentType {
  const v = typeof input === 'string' ? input.trim() : '';
  if (!v) return PaymentType.CASH;
  const norm = v.toUpperCase().replace(/\s+/g, '');
  if (norm === 'CASH') return PaymentType.CASH;
  if (norm === 'CHEQUE' || norm === 'CHECK') return PaymentType.CHEQUE;
  if (norm === 'DD' || norm === 'DEMANDDRAFT') return PaymentType.DD;
  if (norm === 'NEFT') return PaymentType.NEFT;
  // Default to CASH for unknown legacy values like "Cash"
  return PaymentType.CASH;
}

// ─────────────── helpers ───────────────

interface AuthContext {
  tenantId: string;
  userId: string;
}

function ctx(req: Request): AuthContext {
  const user = (req as any).user;
  if (!user?.tenantId || !user?.userId) {
    throw new UnauthorizedException('Authentication required');
  }
  return {
    tenantId: user.tenantId,
    userId: user.userId,
  };
}

function buildUuidPipe(paramName: string) {
  return new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new BadRequestException(`${paramName} must be a valid UUID`),
  });
}

function buildFilePipe() {
  return new ParseFilePipe({
    fileIsRequired: true,
    exceptionFactory: (error) =>
      new BadRequestException(
        typeof error === 'string' && error.length
          ? error
          : 'file is required (multipart form field: "file")',
      ),
    validators: [
      new MaxFileSizeValidator({
        maxSize: MAX_UPLOAD_SIZE_BYTES,
        message: (maxSize) =>
          `file exceeds the maximum allowed size of ${maxSize} bytes`,
      }),
      new FileTypeValidator({
        fileType:
          /(spreadsheetml\.sheet|vnd\.ms-excel|text\/csv|application\/csv)/,
      }),
    ],
  });
}

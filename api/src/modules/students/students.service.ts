import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import { Student } from './entities/student.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { StudentIdentity } from '../student-identities/entities/student-identity.entity';
import { ParentsService } from '../parents/parents.service';
import {
  StudentFeesService,
  StudentFeeSummary,
} from '../fees/student-fees.service';
import {
  UpsertStudentInput,
  UpsertStudentsResult,
  UpdateStudentDto,
} from './dto/student.dto';

/** Chunk size for batched saves. 500 keeps us under Postgres' param limit. */
const BATCH_SIZE = 500;

/** One enrollment (school / hostel / transport) of a person, with fees. */
export interface PersonServiceView {
  tenantId: string;
  serviceType: string | null;
  tenantName: string | null;
  studentId: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  class: string;
  section: string;
  rollNo: string;
  pickupLocation: string | null;
  dropLocation: string | null;
  totalOutstanding: string;
  fees: StudentFeeSummary[];
}

/** A person's services aggregated across the sibling tenants. */
export interface PersonServicesView {
  schoolCode: string;
  admissionNumber: string;
  totalOutstanding: string;
  services: PersonServiceView[];
}

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(StudentIdentity)
    private readonly identityRepo: Repository<StudentIdentity>,
    private readonly parentsService: ParentsService,
    private readonly studentFeesService: StudentFeesService,
  ) {}

  /**
   * Find one student by id, scoped to tenant. Throws 404 if not found
   * or belongs to a different tenant.
   */
  async findOneOrFail(tenantId: string, id: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id, tenantId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }
    return student;
  }

  /**
   * Find by admission number + academic year. Used by the admin UI when
   * the user searches by admission.
   */
  async findByAdmissionYear(
    tenantId: string,
    schoolCode: string,
    admissionNumber: string,
    academicYear: string,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: {
        tenantId,
        // schoolCode is optional scoping — when blank, match on
        // (tenant, admission, year) alone.
        ...(schoolCode ? { schoolCode } : {}),
        admissionNumber,
        academicYear,
      },
    });
    if (!student) {
      throw new NotFoundException(
        `Student with admission ${admissionNumber} not found for ${academicYear}`,
      );
    }
    return student;
  }

  /**
   * Partial update. Only fields present in `dto` are changed. Returns
   * the updated entity.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<Student> {
    const student = await this.findOneOrFail(tenantId, id);

    if (dto.name !== undefined) student.name = dto.name;
    if (dto.email !== undefined) student.email = dto.email.toLowerCase();
    if (dto.phoneNumber !== undefined) student.phoneNumber = dto.phoneNumber;
    if (dto.class !== undefined) student.class = dto.class;
    if (dto.section !== undefined) student.section = dto.section;
    if (dto.rollNo !== undefined) student.rollNo = dto.rollNo;
    if (dto.imgUrl !== undefined) student.imgUrl = dto.imgUrl;
    if (dto.pickupLocation !== undefined)
      student.pickupLocation = dto.pickupLocation || null;
    if (dto.dropLocation !== undefined)
      student.dropLocation = dto.dropLocation || null;

    const saved = await this.studentRepo.save(student);

    // Keep the parent login in sync with the student's parent-contact email.
    if (dto.email !== undefined && saved.email) {
      await this.parentsService.ensureForStudent(tenantId, {
        email: saved.email,
        name: saved.name,
        phoneNumber: saved.phoneNumber,
        admissionNumber: saved.admissionNumber,
      });
    }

    this.logger.log(`Updated student ${id}`);
    return saved;
  }

  /**
   * Stamp TC fields on an enrollment row. The row is not deleted —
   * active-roster queries should filter `tcIssuedAt IS NULL`. Existing
   * fee/payment/receipt history is preserved verbatim.
   */
  async issueTc(
    tenantId: string,
    id: string,
    input: { reason?: string; certificateNo?: string; issuedAt?: string },
  ): Promise<Student> {
    const student = await this.findOneOrFail(tenantId, id);
    if (student.tcIssuedAt) {
      this.logger.warn(
        `TC re-issued for ${student.admissionNumber} (was ${student.tcIssuedAt.toISOString()})`,
      );
    }
    student.tcIssuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
    student.tcReason = input.reason?.trim() || null;
    student.tcCertificateNo = input.certificateNo?.trim() || null;
    return this.studentRepo.save(student);
  }

  /**
   * Revoke a TC (e.g. issued by mistake). Clears all three TC fields.
   */
  async revokeTc(tenantId: string, id: string): Promise<Student> {
    const student = await this.findOneOrFail(tenantId, id);
    student.tcIssuedAt = null;
    student.tcReason = null;
    student.tcCertificateNo = null;
    return this.studentRepo.save(student);
  }

  /**
   * Printable Transfer Certificate (A4 HTML). Only valid once a TC has
   * actually been issued. Particulars are auto-filled from the student
   * row and the linked identity (DOB / gender); anything still unknown
   * is left as a blank for the office to complete and sign.
   */
  async renderTcCertificate(tenantId: string, id: string): Promise<string> {
    const s = await this.findOneOrFail(tenantId, id);
    if (!s.tcIssuedAt) {
      throw new BadRequestException(
        'No TC has been issued for this enrollment yet.',
      );
    }
    const [tenant, identity] = await Promise.all([
      this.tenantRepo.findOne({ where: { id: tenantId } }),
      s.identityId
        ? this.identityRepo.findOne({
            where: { id: s.identityId, tenantId },
          })
        : Promise.resolve(null),
    ]);

    const esc = (v: unknown): string =>
      v == null
        ? ''
        : String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const blank = '<span class="bl">&nbsp;</span>';
    // TZ-safe DD/MM/YYYY from a Date or YYYY-MM-DD string — uses UTC
    // components so the rendered date never shifts by server timezone.
    const fmt = (d: Date | string | null): string => {
      if (!d) return blank;
      const dt = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(dt.getTime())) return blank;
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${dt.getUTCFullYear()}`;
    };

    const schoolName = esc(
      tenant?.tenantName || tenant?.name || 'School',
    ).toUpperCase();
    const addr = [tenant?.address, tenant?.city, tenant?.state]
      .filter(Boolean)
      .map(esc)
      .join(', ');

    const parents = [s.fatherName, s.motherName]
      .filter(Boolean)
      .map(esc)
      .join(' / ');
    const dob = identity?.dateOfBirth ?? null;
    const admittedOn = s.dateOfAdmission ?? s.createdAt ?? null;

    const rows: [string, string][] = [
      ['1. Admission Number', esc(s.admissionNumber)],
      ['2. Name of the Pupil', esc(s.name)],
      ["3. Father's / Mother's Name", parents || blank],
      ['4. Gender', esc(identity?.gender) || blank],
      ['5. Date of Birth', dob ? fmt(dob) : blank],
      [
        '6. Class in which studying',
        `${esc(s.class)} - ${esc(s.section)}`,
      ],
      ['7. Academic Year', esc(s.academicYear)],
      ['8. Date of Admission', admittedOn ? fmt(admittedOn) : blank],
      ['9. Date of Leaving the School', fmt(s.tcIssuedAt)],
      ['10. Reason for Leaving', esc(s.tcReason) || blank],
      ['11. Conduct & Character', blank],
      ['12. Any Fees Due', blank],
      ['13. General Remarks', blank],
    ];

    return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Transfer Certificate — ${esc(s.name)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color:#111; margin:0; }
  .sheet { max-width: 720px; margin: 0 auto; padding: 24px; }
  .hd { text-align:center; border-bottom:2px solid #111; padding-bottom:12px; }
  .hd h1 { margin:0; font-size:24px; letter-spacing:1px; }
  .hd p { margin:4px 0 0; font-size:13px; color:#444; }
  .title { text-align:center; margin:22px 0 6px; font-size:18px;
           font-weight:bold; text-decoration:underline; letter-spacing:2px; }
  .cno { display:flex; justify-content:space-between; font-size:13px;
         margin:14px 2px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  td { padding:9px 6px; font-size:14px; vertical-align:top;
       border-bottom:1px dotted #999; }
  td.k { width:48%; }
  td.v { font-weight:bold; }
  .bl { display:inline-block; min-width:140px; border-bottom:1px solid #555; }
  .ft { margin-top:48px; display:flex; justify-content:space-between;
        font-size:13px; }
  .sig { text-align:center; }
  .sig .ln { margin-top:40px; border-top:1px solid #111; padding-top:4px; }
  .note { margin-top:26px; font-size:11px; color:#666; text-align:center; }
  @media print { .noprint { display:none; } }
</style></head>
<body>
  <div class="sheet">
    <div class="hd">
      <h1>${schoolName}</h1>
      ${addr ? `<p>${addr}</p>` : ''}
    </div>
    <div class="title">TRANSFER CERTIFICATE</div>
    <div class="cno">
      <span>T.C. No: <b>${esc(s.tcCertificateNo) || blank}</b></span>
      <span>Date of Issue: <b>${fmt(s.tcIssuedAt)}</b></span>
    </div>
    <table>
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`,
        )
        .join('')}
    </table>
    <div class="ft">
      <div class="sig"><div class="ln">Class Teacher</div></div>
      <div class="sig"><div class="ln">Office Seal</div></div>
      <div class="sig"><div class="ln">Principal</div></div>
    </div>
    <p class="note">
      This is a system-generated draft. Verify all particulars, complete
      the blank fields, and affix the school seal before issuing.
    </p>
    <p class="noprint" style="text-align:center;margin-top:16px">
      <button onclick="window.print()">Print</button>
    </p>
  </div>
</body></html>`;
  }

  /**
   * Return every enrollment row sharing the identity of the given
   * student, newest first. Used by the "all-time / by-person" view
   * in Payment Details and reports.
   */
  async listByIdentity(tenantId: string, identityId: string): Promise<Student[]> {
    return this.studentRepo.find({
      where: { tenantId, identityId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Same as listByIdentity but starting from an admission number. If
   * the row has no identity yet (legacy), returns just that row.
   */
  async listEnrollmentsByAdmission(
    tenantId: string,
    admissionNumber: string,
  ): Promise<Student[]> {
    const rows = await this.studentRepo.find({
      where: { tenantId, admissionNumber },
    });
    if (rows.length === 0) return [];
    const identityId = rows.find((r) => r.identityId)?.identityId ?? null;
    if (!identityId) return rows;
    return this.listByIdentity(tenantId, identityId);
  }

  async getLatest(tenantId: string): Promise<Student[]> {
    return this.studentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  /**
   * Cross-tenant view of one person's services. School / hostel /
   * transport live in separate sibling tenants that share a school code,
   * so a person's records are matched by (school_code + admission_number)
   * across tenants. Each matched enrollment is returned with its tenant's
   * service type and its fees (term-wise or monthly).
   *
   * This intentionally crosses the tenant boundary. Callers MUST first
   * authorise the requester against a record they already own (a student
   * in their own tenant for admins; a linked child for parents) and pass
   * that record's school_code + admission_number here — never raw,
   * client-supplied values — so the expansion stays within one
   * institution.
   */
  async getServicesForPerson(
    schoolCode: string,
    admissionNumber: string,
    academicYear?: string,
  ): Promise<PersonServicesView> {
    const where: Record<string, string> = { schoolCode, admissionNumber };
    if (academicYear) where.academicYear = academicYear;

    const students = await this.studentRepo.find({
      where,
      order: { academicYear: 'DESC' },
    });

    const tenantIds = [...new Set(students.map((s) => s.tenantId))];
    const tenants = tenantIds.length
      ? await this.tenantRepo.find({ where: { id: In(tenantIds) } })
      : [];
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const services: PersonServiceView[] = [];
    for (const s of students) {
      const tenant = tenantById.get(s.tenantId);
      const fees = await this.studentFeesService.getFeesForStudent(
        s.tenantId,
        s.id,
        s.academicYear,
      );
      const outstanding = fees.reduce(
        (sum, f) => sum + Number(f.remainingAmount),
        0,
      );
      services.push({
        tenantId: s.tenantId,
        serviceType: tenant?.type ?? null,
        tenantName: tenant?.tenantName ?? tenant?.name ?? null,
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        academicYear: s.academicYear,
        name: s.name,
        class: s.class,
        section: s.section,
        rollNo: s.rollNo,
        pickupLocation: s.pickupLocation,
        dropLocation: s.dropLocation,
        totalOutstanding: outstanding.toFixed(2),
        fees,
      });
    }

    const totalOutstanding = services
      .reduce((sum, s) => sum + Number(s.totalOutstanding), 0)
      .toFixed(2);

    return { schoolCode, admissionNumber, totalOutstanding, services };
  }

  /**
   * Bulk upsert used by the Excel upload flow. Runs inside the caller's
   * transaction so students + fees commit together.
   */
  async bulkUpsert(
    inputs: UpsertStudentInput[],
    manager: EntityManager,
  ): Promise<UpsertStudentsResult> {
    const repo = manager.getRepository(Student);
    const idByKey = new Map<string, string>();

    if (!inputs.length) return { created: 0, updated: 0, idByKey };

    const { tenantId, schoolCode } = inputs[0];

    // 1. Load all existing students for this upload in one query
    const admissions = [...new Set(inputs.map((i) => i.admissionNumber))];
    const years = [...new Set(inputs.map((i) => i.academicYear))];

    const existing = await repo.find({
      where: {
        tenantId,
        schoolCode,
        admissionNumber: In(admissions),
        academicYear: In(years),
      },
    });

    const existingMap = new Map<string, Student>();
    for (const s of existing) {
      existingMap.set(this.key(s.admissionNumber, s.academicYear), s);
    }

    // 2. Partition into create vs skip. Existing records are NEVER updated
    //    from an upload — once a student row exists it is immutable here, so
    //    re-uploading the same admission leaves its details as they are. We
    //    still resolve its id so brand-new fee periods can be attached.
    const toCreate: Student[] = [];
    let skipped = 0;

    for (const input of inputs) {
      const k = this.key(input.admissionNumber, input.academicYear);
      const found = existingMap.get(k);

      if (found) {
        idByKey.set(k, found.id);
        skipped++;
      } else {
        toCreate.push(repo.create(input));
      }
    }

    // 3. Batch inserts (new students only)
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const chunk = toCreate.slice(i, i + BATCH_SIZE);
      const saved = await repo.save(chunk);
      saved.forEach((s) =>
        idByKey.set(this.key(s.admissionNumber, s.academicYear), s.id),
      );
    }

    this.logger.log(
      `Upserted students: ${toCreate.length} created, ${skipped} existing left unchanged`,
    );
    return { created: toCreate.length, updated: 0, idByKey };
  }

  /**
   * Paginated list of students scoped to the tenant. Filters are ANDed:
   * if multiple are passed, all must match.
   *
   * `search` is a case-insensitive contains match on name OR
   * admission_number — the typical search-bar behaviour.
   *
   * Results are ordered by class → section → roll number for a
   * teacher-friendly default.
   */
  async list(
    tenantId: string,
    filters: {
      academicYear?: string;
      schoolCode?: string;
      class?: string;
      section?: string;
      search?: string;
      tcStatus?: 'active' | 'tc_issued' | 'all';
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: Student[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    const qb = this.studentRepo
      .createQueryBuilder('student')
      .where('student.tenantId = :tenantId', { tenantId });

    if (filters.academicYear) {
      qb.andWhere('student.academicYear = :year', {
        year: filters.academicYear,
      });
    }
    if (filters.schoolCode) {
      qb.andWhere('student.schoolCode = :schoolCode', {
        schoolCode: filters.schoolCode,
      });
    }
    if (filters.class) {
      qb.andWhere('student.class = :class', { class: filters.class });
    }
    if (filters.section) {
      qb.andWhere('student.section = :section', { section: filters.section });
    }
    if (filters.search) {
      // ILIKE is Postgres-specific case-insensitive match.
      qb.andWhere(
        '(student.name ILIKE :q OR student.admissionNumber ILIKE :q)',
        { q: `%${filters.search}%` },
      );
    }
    if (filters.tcStatus === 'tc_issued') {
      qb.andWhere('student.tcIssuedAt IS NOT NULL');
    } else if (filters.tcStatus === 'active') {
      qb.andWhere('student.tcIssuedAt IS NULL');
    }

    qb.orderBy('student.class', 'ASC')
      .addOrderBy('student.section', 'ASC')
      .addOrderBy('student.rollNo', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Shared key format so callers match without duplicating logic. */
  key(admissionNumber: string, academicYear: string): string {
    return `${admissionNumber}::${academicYear}`;
  }
}
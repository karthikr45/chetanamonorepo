import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { StudentIdentity } from './entities/student-identity.entity';
import { Student } from '../students/entities/student.entity';
import { Fee, PaymentStatus } from '../fees/entities/fee.entity';

export interface IdentityMatch {
  identity: StudentIdentity;
  enrollments: Array<{
    id: string;
    admissionNumber: string;
    academicYear: string;
    branch: string;
    class: string;
    section: string;
    rollNo: string;
    tcIssuedAt: Date | null;
    createdAt: Date;
  }>;
  /** Most recent admission number for display. */
  latestAdmissionNumber: string | null;
}

/**
 * Service for the "is this person already on record?" admission step,
 * plus the backfill that gives every existing student row an identity.
 */
@Injectable()
export class StudentIdentitiesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StudentIdentitiesService.name);

  constructor(
    @InjectRepository(StudentIdentity)
    private readonly idRepo: Repository<StudentIdentity>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Auto-backfill on boot so the office never has to call an API.
   * Idempotent — only touches rows whose identity_id is null. On a
   * fully-migrated DB this is a single COUNT and returns immediately.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const missing = await this.studentRepo
        .createQueryBuilder('s')
        .where('s.identityId IS NULL')
        .getCount();
      if (missing === 0) return;
      const { rowsBackfilled, identitiesCreated } =
        await this.ensureIdentitiesForExisting();
      this.logger.log(
        `Identity backfill: ${identitiesCreated} identities created, ` +
          `${rowsBackfilled} student rows linked.`,
      );
    } catch (err) {
      this.logger.warn(
        `Identity auto-backfill skipped: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Find candidates likely to be the same person as the query. Used
   * by the admission form's first step. We OR together name (fuzzy),
   * phone (exact-ish), email (exact-ish). Caller's tenant only.
   */
  async findMatches(
    tenantId: string,
    query: { name?: string; phone?: string; email?: string },
  ): Promise<IdentityMatch[]> {
    const name = query.name?.trim();
    const phone = query.phone?.trim();
    const email = query.email?.trim().toLowerCase();
    if (!name && !phone && !email) return [];

    const qb = this.idRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tid', { tid: tenantId });
    const ors: string[] = [];
    const params: Record<string, unknown> = {};
    if (name) {
      ors.push('LOWER(i.displayName) LIKE :nameLike');
      params.nameLike = `%${name.toLowerCase()}%`;
    }
    if (phone) {
      ors.push("regexp_replace(i.primaryPhone, '\\D', '', 'g') LIKE :phoneLike");
      params.phoneLike = `%${phone.replace(/\D/g, '')}%`;
    }
    if (email) {
      ors.push('LOWER(i.primaryEmail) = :emailExact');
      params.emailExact = email;
    }
    if (ors.length) {
      qb.andWhere(`(${ors.join(' OR ')})`, params);
    }

    const identities = await qb
      .orderBy('i.updatedAt', 'DESC')
      .limit(15)
      .getMany();
    return this.attachEnrollments(identities);
  }

  async findOne(tenantId: string, id: string): Promise<IdentityMatch> {
    const identity = await this.idRepo.findOne({ where: { id, tenantId } });
    if (!identity) throw new NotFoundException(`Identity ${id} not found`);
    const [withEnrollments] = await this.attachEnrollments([identity]);
    return withEnrollments;
  }

  /**
   * Per-enrollment outstanding totals for one identity. Used by the
   * identity page to show "₹X unpaid" beside alumni rows, and by the
   * re-admission banner.
   */
  async outstandingForIdentity(
    tenantId: string,
    identityId: string,
  ): Promise<{
    identityId: string;
    totalOutstanding: string;
    perEnrollment: Array<{
      studentId: string;
      admissionNumber: string;
      academicYear: string;
      branch: string;
      tcIssuedAt: Date | null;
      totalOutstanding: string;
      unpaidFees: Array<{ feeId: string; term: string; remaining: string }>;
    }>;
  }> {
    const identity = await this.idRepo.findOne({
      where: { id: identityId, tenantId },
    });
    if (!identity) throw new NotFoundException(`Identity ${identityId} not found`);

    const students = await this.studentRepo.find({
      where: { tenantId, identityId },
      order: { createdAt: 'DESC' },
    });
    if (students.length === 0) {
      return { identityId, totalOutstanding: '0.00', perEnrollment: [] };
    }
    const studentIds = students.map((s) => s.id);
    const feeRepo = this.dataSource.getRepository(Fee);
    const fees = await feeRepo.find({
      where: { tenantId, studentId: In(studentIds) },
    });

    let totalOutstanding = 0;
    const perEnrollment = students.map((s) => {
      const feesForRow = fees.filter((f) => f.studentId === s.id);
      const unpaidFees = feesForRow
        .map((f) => {
          const remaining = Math.max(
            0,
            Number(f.netAmount) - Number(f.paidAmount),
          );
          return { fee: f, remaining };
        })
        .filter(({ remaining }) => remaining > 0)
        .map(({ fee, remaining }) => ({
          feeId: fee.id,
          term: fee.term,
          remaining: remaining.toFixed(2),
        }));
      const rowTotal = unpaidFees.reduce(
        (sum, f) => sum + Number(f.remaining),
        0,
      );
      totalOutstanding += rowTotal;
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        academicYear: s.academicYear,
        branch: s.schoolCode,
        tcIssuedAt: s.tcIssuedAt,
        totalOutstanding: rowTotal.toFixed(2),
        unpaidFees,
      };
    });

    return {
      identityId,
      totalOutstanding: totalOutstanding.toFixed(2),
      perEnrollment,
    };
  }

  async create(
    tenantId: string,
    dto: {
      displayName: string;
      primaryPhone?: string | null;
      primaryEmail?: string | null;
      dateOfBirth?: string | null;
      gender?: string | null;
      photoUrl?: string | null;
      notes?: string | null;
    },
  ): Promise<StudentIdentity> {
    return this.idRepo.save(
      this.idRepo.create({
        tenantId,
        displayName: dto.displayName.trim(),
        primaryPhone: dto.primaryPhone?.trim() || null,
        primaryEmail: dto.primaryEmail?.trim().toLowerCase() || null,
        dateOfBirth: dto.dateOfBirth ?? null,
        gender: dto.gender ?? null,
        photoUrl: dto.photoUrl ?? null,
        notes: dto.notes ?? null,
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      displayName: string;
      primaryPhone: string | null;
      primaryEmail: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      photoUrl: string | null;
      notes: string | null;
    }>,
  ): Promise<StudentIdentity> {
    const identity = await this.idRepo.findOne({ where: { id, tenantId } });
    if (!identity) throw new NotFoundException(`Identity ${id} not found`);
    if (dto.displayName !== undefined) identity.displayName = dto.displayName.trim();
    if (dto.primaryPhone !== undefined) {
      identity.primaryPhone = dto.primaryPhone?.trim() || null;
    }
    if (dto.primaryEmail !== undefined) {
      identity.primaryEmail = dto.primaryEmail?.trim().toLowerCase() || null;
    }
    if (dto.dateOfBirth !== undefined) identity.dateOfBirth = dto.dateOfBirth ?? null;
    if (dto.gender !== undefined) identity.gender = dto.gender ?? null;
    if (dto.photoUrl !== undefined) identity.photoUrl = dto.photoUrl ?? null;
    if (dto.notes !== undefined) identity.notes = dto.notes ?? null;
    return this.idRepo.save(identity);
  }

  /**
   * Backfill: ensure every existing `students` row has an identity_id.
   * Groups by (tenantId, lower(email)) AND falls back to admission +
   * phone collisions so siblings using the same parent email but
   * different admission numbers don't collapse. Safe to re-run.
   */
  async ensureIdentitiesForExisting(): Promise<{
    rowsBackfilled: number;
    identitiesCreated: number;
  }> {
    // Pull only rows missing an identity, then group in JS so the
    // same person across academic years lands on one identity.
    const needsIdentity = await this.studentRepo
      .createQueryBuilder('s')
      .where('s.identityId IS NULL')
      .getMany();
    let created = 0;
    let backfilled = 0;

    // Group within tenant by (admission_number, email lowercased) so
    // the same person across academic years lands on one identity.
    const groups = new Map<string, Student[]>();
    for (const s of needsIdentity) {
      const key = [
        s.tenantId,
        s.admissionNumber,
        (s.email ?? '').toLowerCase(),
      ].join('|');
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }

    for (const group of groups.values()) {
      const sample = group[0];
      const identity = await this.idRepo.save(
        this.idRepo.create({
          tenantId: sample.tenantId,
          displayName: sample.name,
          primaryEmail: (sample.email ?? '').toLowerCase() || null,
          primaryPhone: sample.phoneNumber ?? null,
        }),
      );
      created++;
      for (const s of group) {
        await this.studentRepo.update({ id: s.id }, { identityId: identity.id });
        backfilled++;
      }
    }
    return { rowsBackfilled: backfilled, identitiesCreated: created };
  }

  // ─── Internals ───────────────────────────────────────────────────

  private async attachEnrollments(
    identities: StudentIdentity[],
  ): Promise<IdentityMatch[]> {
    if (identities.length === 0) return [];
    const ids = identities.map((i) => i.id);
    const students = await this.studentRepo.find({
      where: { identityId: In(ids) },
      order: { createdAt: 'DESC' },
    });
    const byIdentity = new Map<string, Student[]>();
    for (const s of students) {
      if (!s.identityId) continue;
      const arr = byIdentity.get(s.identityId) ?? [];
      arr.push(s);
      byIdentity.set(s.identityId, arr);
    }
    return identities.map((i) => {
      const enrollments = byIdentity.get(i.id) ?? [];
      return {
        identity: i,
        enrollments: enrollments.map((s) => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          academicYear: s.academicYear,
          branch: s.schoolCode,
          class: s.class,
          section: s.section,
          rollNo: s.rollNo,
          tcIssuedAt: s.tcIssuedAt,
          createdAt: s.createdAt,
        })),
        latestAdmissionNumber: enrollments[0]?.admissionNumber ?? null,
      };
    });
  }
}

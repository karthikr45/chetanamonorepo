import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Fee } from './entities/fee.entity';

export interface FeePaymentView {
  id: string;
  amount: string;
  paymentType: string;
  orderId: string | null;
  transactionId: string | null;
  chequeNumber: string | null;
  ddNumber: string | null;
  bankName: string | null;
  paidAt: Date | null;
}

export interface StudentFeeSummary {
  feeId: string;
  term: string;
  originalAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  netAmount: string;
  paidAmount: string;
  remainingAmount: string;
  paymentStatus: string;
  payments: FeePaymentView[];
}

/**
 * Read-side service that returns all fees for a given student in a given
 * academic year, straight from the `fees` table (which already carries the
 * per-term net / paid / status).
 *
 * It deliberately does NOT read the `payments` table — that table holds the
 * individual transactions / offline payment records and is fetched on demand
 * via the dedicated payment endpoints (e.g. GET /fees/:id/payments). The
 * students list only needs the fee summary, so it stays a single query.
 */
@Injectable()
export class StudentFeesService {
  constructor(
    @InjectRepository(Fee) private readonly feeRepo: Repository<Fee>,
  ) {}

  async getFeesForStudent(
    tenantId: string,
    studentId: string,
    academicYear: string,
  ): Promise<StudentFeeSummary[]> {
    const grouped = await this.getFeesForStudents(tenantId, [
      { studentId, academicYear },
    ]);
    return grouped.get(studentId) ?? [];
  }

  /**
   * Bulk variant used by list endpoints. Fetches fees for many students in a
   * single query (from the `fees` table) regardless of student count.
   * Returns a map keyed by studentId; students with no fees are absent.
   *
   * Each ref carries its own academicYear because students in a list may
   * span years. A fee is only returned when its (studentId, academicYear)
   * exactly matches one of the requested pairs.
   */
  async getFeesForStudents(
    tenantId: string,
    refs: Array<{ studentId: string; academicYear: string }>,
  ): Promise<Map<string, StudentFeeSummary[]>> {
    const out = new Map<string, StudentFeeSummary[]>();
    if (!refs.length) return out;

    const studentIds = [...new Set(refs.map((r) => r.studentId))];
    const academicYears = [...new Set(refs.map((r) => r.academicYear))];

    const fees = await this.feeRepo.find({
      where: {
        tenantId,
        studentId: In(studentIds),
        academicYear: In(academicYears),
      },
      order: { term: 'ASC' },
    });

    // IN-filter is a superset when refs span multiple years — keep only
    // fees whose (studentId, academicYear) matches a requested pair.
    const allowed = new Set(
      refs.map((r) => `${r.studentId}::${r.academicYear}`),
    );
    const matched = fees.filter((f) =>
      allowed.has(`${f.studentId}::${f.academicYear}`),
    );

    if (!matched.length) return out;

    for (const fee of matched) {
      const summary: StudentFeeSummary = {
        feeId: fee.id,
        term: fee.term,
        originalAmount: fee.originalAmount,
        totalPenalty: fee.totalPenalty,
        totalDiscount: fee.totalDiscount,
        netAmount: fee.netAmount,
        paidAmount: fee.paidAmount,
        remainingAmount: (
          Number(fee.netAmount) - Number(fee.paidAmount)
        ).toFixed(2),
        paymentStatus: fee.paymentStatus,
        // Payment transactions live in the `payments` table and are fetched
        // on demand via the payment endpoints — not joined into the list.
        payments: [],
      };
      if (!out.has(fee.studentId)) out.set(fee.studentId, []);
      out.get(fee.studentId)!.push(summary);
    }

    return out;
  }
}
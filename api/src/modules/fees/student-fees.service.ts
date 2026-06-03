import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Fee } from './entities/fee.entity';
import { FeePayment } from './entities/fee-payment.entity';

export interface FeePaymentView {
  id: string;
  amount: string;
  paymentType: string;
  orderId: string | null;
  transactionId: string | null;
  chequeNumber: string | null;
  ddNumber: string | null;
  bankName: string | null;
  paidAt: Date;
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
 * academic year, each fee with its payment history.
 *
 * Lives in the fees module (not students) because it reads only from
 * fees-owned tables. The students controller calls this to build the
 * "student with fees" response; the students module thus depends one-way
 * on fees, no circular import.
 */
@Injectable()
export class StudentFeesService {
  constructor(
    @InjectRepository(Fee) private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeePayment)
    private readonly paymentRepo: Repository<FeePayment>,
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
   * Bulk variant used by list endpoints. Fetches fees + payments for many
   * students in two queries regardless of the student count, avoiding N+1.
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

    const feeIds = matched.map((f) => f.id);
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.feeId IN (:...feeIds)', { feeIds })
      .andWhere('p.tenantId = :tenantId', { tenantId })
      .orderBy('p.paidAt', 'DESC')
      .getMany();

    const paymentsByFeeId = new Map<string, FeePayment[]>();
    for (const p of payments) {
      if (!paymentsByFeeId.has(p.feeId)) paymentsByFeeId.set(p.feeId, []);
      paymentsByFeeId.get(p.feeId)!.push(p);
    }

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
        payments: (paymentsByFeeId.get(fee.id) ?? []).map((p) => ({
          id: p.id,
          amount: p.amount,
          paymentType: p.paymentType,
          orderId: p.orderId,
          transactionId: p.transactionId,
          chequeNumber: p.chequeNumber,
          ddNumber: p.ddNumber,
          bankName: p.bankName,
          paidAt: p.paidAt,
        })),
      };
      if (!out.has(fee.studentId)) out.set(fee.studentId, []);
      out.get(fee.studentId)!.push(summary);
    }

    return out;
  }
}
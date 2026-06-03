import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  ClearanceStatus,
  FeePayment,
} from '../fees/entities/fee-payment.entity';
import { Fee } from '../fees/entities/fee.entity';
import { Student } from '../students/entities/student.entity';

export interface ReportFilters {
  from?: string;
  to?: string;
  branch?: string;
  academicYear?: string;
  class?: string;
  term?: string;
}

type ReportType = 'fee-collection' | 'outstanding-fees' | 'payment-summary';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(FeePayment)
    private readonly feePaymentRepo: Repository<FeePayment>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  /**
   * Collections ledger for a date range. Excludes BOUNCED rows (the money
   * never settled). Pending cheque/DD is shown separately so the office
   * can see "in hand vs. cleared".
   */
  async getFeeCollectionReport(tenantId: string, filters: ReportFilters) {
    const qb = this.feePaymentRepo
      .createQueryBuilder('fp')
      .innerJoin(Fee, 'fee', 'fee.id = fp.feeId')
      .innerJoin(
        Student,
        'st',
        'st.id = fee.studentId AND st.tenantId = fp.tenantId',
      )
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.clearanceStatus != :bounced', {
        bounced: ClearanceStatus.BOUNCED,
      });

    this.applyDateRange(qb, 'fp.paidAt', filters);
    if (filters.branch)
      qb.andWhere('fp.branch = :branch', { branch: filters.branch });
    if (filters.academicYear)
      qb.andWhere('fee.academicYear = :ay', { ay: filters.academicYear });
    if (filters.class)
      qb.andWhere('st.class = :cls', { cls: filters.class });
    if (filters.term) qb.andWhere('fee.term = :term', { term: filters.term });

    const rows = await qb
      .select([
        'fp.id AS id',
        'fp.paidAt AS "paidAt"',
        'fp.amount AS amount',
        'fp.paymentType AS "paymentType"',
        'fp.clearanceStatus AS "clearanceStatus"',
        'fp.receiptNumber AS "receiptNumber"',
        'st.name AS "studentName"',
        'st.admissionNumber AS "admissionNumber"',
        'st.class AS class',
        'st.section AS section',
        'fee.term AS term',
        'fee.academicYear AS "academicYear"',
        'fp.branch AS branch',
      ])
      .orderBy('fp.paidAt', 'DESC')
      .getRawMany();

    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const pending = rows
      .filter((r) => r.clearanceStatus === ClearanceStatus.PENDING)
      .reduce((s, r) => s + Number(r.amount), 0);
    const byMode: Record<string, number> = {};
    for (const r of rows) {
      byMode[r.paymentType] =
        (byMode[r.paymentType] ?? 0) + Number(r.amount);
    }

    return {
      rows,
      summary: {
        count: rows.length,
        totalCollected: total,
        pendingClearance: pending,
        clearedOrInstant: total - pending,
        byMode,
      },
    };
  }

  /** Students with an outstanding balance (net − paid > 0). */
  async getOutstandingFeesReport(tenantId: string, filters: ReportFilters) {
    const qb = this.feeRepo
      .createQueryBuilder('fee')
      .innerJoin(
        Student,
        'st',
        'st.id = fee.studentId AND st.tenantId = fee.tenantId',
      )
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('(fee.netAmount - fee.paidAmount) > 0');

    if (filters.branch)
      qb.andWhere('fee.branch = :branch', { branch: filters.branch });
    if (filters.academicYear)
      qb.andWhere('fee.academicYear = :ay', { ay: filters.academicYear });
    if (filters.class)
      qb.andWhere('st.class = :cls', { cls: filters.class });
    if (filters.term) qb.andWhere('fee.term = :term', { term: filters.term });

    const rows = await qb
      .select([
        'fee.id AS id',
        'st.name AS "studentName"',
        'st.admissionNumber AS "admissionNumber"',
        'st.class AS class',
        'st.section AS section',
        'fee.term AS term',
        'fee.academicYear AS "academicYear"',
        'fee.branch AS branch',
        'fee.netAmount AS "netAmount"',
        'fee.paidAmount AS "paidAmount"',
        '(fee.netAmount - fee.paidAmount) AS balance',
        'fee.paymentStatus AS "paymentStatus"',
      ])
      .orderBy('balance', 'DESC')
      .getRawMany();

    const totalOutstanding = rows.reduce(
      (s, r) => s + Number(r.balance),
      0,
    );
    return {
      rows,
      summary: {
        students: new Set(rows.map((r) => r.admissionNumber)).size,
        feeRecords: rows.length,
        totalOutstanding,
      },
    };
  }

  /** Day-by-day collection totals for a date range (defaults last 30 days). */
  async getPaymentSummaryReport(tenantId: string, filters: ReportFilters) {
    const qb = this.feePaymentRepo
      .createQueryBuilder('fp')
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.clearanceStatus != :bounced', {
        bounced: ClearanceStatus.BOUNCED,
      });

    if (!filters.from && !filters.to) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      qb.andWhere('fp.paidAt >= :defaultFrom', {
        defaultFrom: d.toISOString(),
      });
    } else {
      this.applyDateRange(qb, 'fp.paidAt', filters);
    }
    if (filters.branch)
      qb.andWhere('fp.branch = :branch', { branch: filters.branch });

    const rows = await qb
      .select("to_char(fp.paidAt, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(fp.amount)', 'amount')
      .groupBy('day')
      .orderBy('day', 'DESC')
      .getRawMany();

    const normalized = rows.map((r) => ({
      day: r.day,
      count: Number(r.count),
      amount: Number(r.amount),
    }));
    return {
      rows: normalized,
      summary: {
        days: normalized.length,
        totalCollected: normalized.reduce((s, r) => s + r.amount, 0),
        transactions: normalized.reduce((s, r) => s + r.count, 0),
      },
    };
  }

  /** Builds an .xlsx workbook for any of the three reports. */
  async exportReport(
    tenantId: string,
    type: ReportType,
    filters: ReportFilters,
  ): Promise<{ buffer: Buffer; filename: string }> {
    let rows: any[];
    let sheetName: string;
    if (type === 'fee-collection') {
      rows = (await this.getFeeCollectionReport(tenantId, filters)).rows;
      sheetName = 'Fee Collection';
    } else if (type === 'outstanding-fees') {
      rows = (await this.getOutstandingFeesReport(tenantId, filters)).rows;
      sheetName = 'Outstanding Fees';
    } else if (type === 'payment-summary') {
      rows = (await this.getPaymentSummaryReport(tenantId, filters)).rows;
      sheetName = 'Daily Collection';
    } else {
      throw new BadRequestException(`Unknown report type: ${type}`);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `${type}-${stamp}.xlsx` };
  }

  private applyDateRange(
    qb: { andWhere: (s: string, p?: any) => unknown },
    column: string,
    filters: ReportFilters,
  ) {
    if (filters.from) {
      qb.andWhere(`${column} >= :from`, {
        from: new Date(filters.from).toISOString(),
      });
    }
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      qb.andWhere(`${column} <= :to`, { to: to.toISOString() });
    }
  }
}

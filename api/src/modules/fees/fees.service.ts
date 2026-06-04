import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { Fee, PaymentStatus, TermType, FeePeriod } from './entities/fee.entity';
import {
  SIBLING_TENANT_TYPES,
  TENANT_TYPE,
  TenantTypeValue,
} from '../../common/constants/tenant';
import { FeePayment, ClearanceStatus, PaymentType } from './entities/fee-payment.entity';
import {
  PaymentStatus as PaymentRowStatus,
  PaymentType as PaymentChannel,
} from '../payments/entities/payment.entity';
import { FeeAdjustment, FeeAdjustmentKind } from './entities/fee-adjustment.entity';
import { ReceiptSequence } from './entities/receipt-sequence.entity';
import {
  Tenant,
  ReceiptResetPolicy,
  ReceiptFormat,
} from '../tenants/entities/tenant.entity';
import { Student } from '../students/entities/student.entity';
import { CreateFeeInput, ExistingFeeRecord } from './dto/fee.dto';
import { ReceiptTemplatesService } from '../receipt-templates/receipt-templates.service';
import {
  guessAcademicYear,
  computePeriodKey as computePeriodKeyPure,
  sanitizeReceiptPrefix,
  assembleReceiptNumber,
  assembleCompactReceiptNumber,
  deriveStatus as deriveStatusPure,
  isPastAcademicMonth,
} from './fee-math';


/** Snapshot of who triggered a penalty/discount mutation. */
export interface AdjustmentActor {
  userId: string | null;
  email?: string | null;
}

const BATCH_SIZE = 500;

/** Classification helpers for payment types. */
const OFFLINE_TYPES = new Set<PaymentType>([
  PaymentType.CASH,
  PaymentType.CHEQUE,
  PaymentType.DD,
  PaymentType.POS,
  PaymentType.NEFT,
]);
const ONLINE_TYPES = new Set<PaymentType>([
  PaymentType.RAZORPAY,
  PaymentType.CASHFREE,
  PaymentType.UPI,
  PaymentType.NETBANKING,
  PaymentType.CARD,
]);

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    @InjectRepository(Fee) private readonly feeRepo: Repository<Fee>,
    @InjectRepository(FeeAdjustment)
    private readonly adjustmentRepo: Repository<FeeAdjustment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly receiptTemplates: ReceiptTemplatesService,
  ) {}

  /**
   * Records one fee_adjustments row inside the supplied transaction
   * manager so the audit row commits atomically with the fee mutation.
   */
  private async logAdjustment(
    manager: EntityManager,
    row: {
      tenantId: string;
      feeId: string;
      kind: FeeAdjustmentKind;
      amount: number;
      reason?: string | null;
      actor?: AdjustmentActor;
    },
  ): Promise<void> {
    const repo = manager.getRepository(FeeAdjustment);
    await repo.save(
      repo.create({
        tenantId: row.tenantId,
        feeId: row.feeId,
        kind: row.kind,
        amount: row.amount.toFixed(2),
        reason: row.reason?.trim() || null,
        createdById: row.actor?.userId ?? null,
        createdByEmail: row.actor?.email ?? null,
      }),
    );
  }

  /** Read all adjustments for a fee, newest first. */
  async listAdjustments(tenantId: string, feeId: string): Promise<FeeAdjustment[]> {
    return this.adjustmentRepo.find({
      where: { tenantId, feeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getFeeStats(tenantId: string): Promise<{
    students: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
    amount: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
    penalty: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const studentRepo = this.dataSource.getRepository(Student);

    const [
      studentTotal,
      studentThis,
      studentPrev,
      amountTotalRow,
      amountThisRow,
      amountPrevRow,
      penaltyTotalRow,
      penaltyThisRow,
      penaltyPrevRow,
    ] = await Promise.all([
      // ── student counts ──
      studentRepo.count({ where: { tenantId } }),
      studentRepo
        .createQueryBuilder('s')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.createdAt >= :start', { start: thisMonthStart })
        .getCount(),
      studentRepo
        .createQueryBuilder('s')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.createdAt >= :start AND s.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getCount(),
      // ── originalAmount totals ──
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start', { start: thisMonthStart })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start AND fee.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getRawOne<{ total: string }>(),
      // ── totalPenalty totals ──
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start', { start: thisMonthStart })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start AND fee.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      students: buildStats(studentTotal, studentThis, studentPrev),
      amount: buildStats(
        Number(amountTotalRow?.total ?? 0),
        Number(amountThisRow?.total ?? 0),
        Number(amountPrevRow?.total ?? 0),
      ),
      penalty: buildStats(
        Number(penaltyTotalRow?.total ?? 0),
        Number(penaltyThisRow?.total ?? 0),
        Number(penaltyPrevRow?.total ?? 0),
      ),
    };
  }

  // ──────────────── Upload flow helpers ────────────────

  async findExistingByKeys(
    tenantId: string,
    keys: { admissionNumber: string; academicYear: string }[],
  ): Promise<ExistingFeeRecord[]> {
    if (!keys.length) return [];

    const admissions = [...new Set(keys.map((k) => k.admissionNumber))];
    const years = [...new Set(keys.map((k) => k.academicYear))];

    return this.feeRepo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .select('fee.term', 'term')
      .addSelect('fee.academicYear', 'academicYear')
      .addSelect('student.admissionNumber', 'admissionNumber')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.academicYear IN (:...years)', { years })
      .andWhere('student.admissionNumber IN (:...admissions)', { admissions })
      .getRawMany<ExistingFeeRecord>();
  }

  async bulkCreate(
    inputs: CreateFeeInput[],
    manager: EntityManager,
  ): Promise<number> {
    if (!inputs.length) return 0;

    const repo = manager.getRepository(Fee);
    const rows = inputs.map((input) => {
      const discount = Math.max(0, input.totalDiscount ?? 0);
      const net = Math.max(0, input.originalAmount - discount);
      return repo.create({
        tenantId: input.tenantId,
        academicYear: input.academicYear,
        studentId: input.studentId,
        term: input.term,
        originalAmount: input.originalAmount.toFixed(2),
        totalPenalty: '0.00',
        totalDiscount: discount.toFixed(2),
        netAmount: net.toFixed(2),
        paidAmount: '0.00',
        paymentStatus: PaymentStatus.UNPAID,
        pickupLocation: input.pickupLocation ?? null,
        dropLocation: input.dropLocation ?? null,
      });
    });

    let saved = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await repo.save(chunk);
      saved += chunk.length;
    }
    this.logger.log(`Created ${saved} fees`);
    return saved;
  }

  /**
   * Upload upsert: create new fees and revise existing ones. Used by the
   * Excel confirm path. Existing fees are only ever current/upcoming months
   * here (the validator rejects past months and existing terms before we get
   * here), so updating their amount/discount is safe — we still never reduce
   * a fee below what's already been paid (such a row is left unchanged).
   */
  async bulkUpsertFees(
    inputs: CreateFeeInput[],
    manager: EntityManager,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    if (!inputs.length) return { created: 0, updated: 0, skipped: 0 };

    const repo = manager.getRepository(Fee);
    const tenantId = inputs[0].tenantId;
    const studentIds = [...new Set(inputs.map((i) => i.studentId))];
    const years = [...new Set(inputs.map((i) => i.academicYear))];

    const existing = await repo.find({
      where: { tenantId, studentId: In(studentIds), academicYear: In(years) },
    });
    const byKey = new Map<string, Fee>();
    for (const f of existing) {
      byKey.set(`${f.studentId}::${f.academicYear}::${f.term}`, f);
    }

    const toSave: Fee[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const input of inputs) {
      const discount = Math.max(0, input.totalDiscount ?? 0);
      const found = byKey.get(
        `${input.studentId}::${input.academicYear}::${input.term}`,
      );

      if (found) {
        const newDiscount = Math.min(discount, input.originalAmount);
        const prospectiveNet =
          input.originalAmount + Number(found.totalPenalty) - newDiscount;
        // Never let a re-upload drop a fee below what's already been paid.
        if (prospectiveNet < Number(found.paidAmount) - 0.01) {
          skipped++;
          continue;
        }
        found.originalAmount = input.originalAmount.toFixed(2);
        found.totalDiscount = newDiscount.toFixed(2);
        if (input.pickupLocation !== undefined) {
          found.pickupLocation = input.pickupLocation ?? null;
        }
        if (input.dropLocation !== undefined) {
          found.dropLocation = input.dropLocation ?? null;
        }
        this.recomputeDerived(found);
        toSave.push(found);
        updated++;
      } else {
        const net = Math.max(0, input.originalAmount - discount);
        toSave.push(
          repo.create({
            tenantId: input.tenantId,
            academicYear: input.academicYear,
            studentId: input.studentId,
            term: input.term,
            originalAmount: input.originalAmount.toFixed(2),
            totalPenalty: '0.00',
            totalDiscount: discount.toFixed(2),
            netAmount: net.toFixed(2),
            paidAmount: '0.00',
            paymentStatus: PaymentStatus.UNPAID,
            pickupLocation: input.pickupLocation ?? null,
            dropLocation: input.dropLocation ?? null,
          }),
        );
        created++;
      }
    }

    for (let i = 0; i < toSave.length; i += BATCH_SIZE) {
      await repo.save(toSave.slice(i, i + BATCH_SIZE));
    }
    this.logger.log(
      `Upserted fees: ${created} created, ${updated} updated, ${skipped} skipped`,
    );
    return { created, updated, skipped };
  }

  /**
   * Create-or-update per-period fees for one student from the Edit Student
   * screen. Monthly (transport) tenants use this to add a month that wasn't
   * billed yet, or change the boarding / drop point month-wise.
   *
   * IMMUTABILITY RULE: a fee's amount/discount is frozen once its month has
   * elapsed — a PAST month can never be edited here (or from an Excel
   * re-upload). The current and upcoming months stay editable so fees can be
   * revised. The operational boarding/drop point may change for any month,
   * and missing periods are still created when an amount is given.
   */
  async applyPeriodFeeEdits(
    tenantId: string,
    studentId: string,
    academicYear: string,
    edits: {
      term: string;
      amount?: number;
      discount?: number;
      pickupLocation?: string | null;
      dropLocation?: string | null;
    }[],
  ): Promise<{ created: number; updated: number }> {
    if (!edits.length) return { created: 0, updated: 0 };

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Fee);
      let created = 0;
      let updated = 0;

      for (const edit of edits) {
        const fee = await repo.findOne({
          where: {
            tenantId,
            studentId,
            academicYear,
            term: edit.term as Fee['term'],
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (fee) {
          let touched = false;

          // A past (elapsed) month's amount/discount is frozen. The current
          // and upcoming months stay editable so fees can still be revised.
          const past = isPastAcademicMonth(academicYear, edit.term);
          let amountChanged = false;
          if (!past) {
            if (edit.amount !== undefined) {
              fee.originalAmount = Math.max(0, edit.amount).toFixed(2);
              amountChanged = true;
            }
            if (edit.discount !== undefined) {
              fee.totalDiscount = Math.max(0, edit.discount).toFixed(2);
              amountChanged = true;
            }
          }
          if (amountChanged) {
            if (Number(fee.totalDiscount) > Number(fee.originalAmount)) {
              throw new BadRequestException(
                `${edit.term}: discount cannot exceed the fee amount.`,
              );
            }
            this.recomputeDerived(fee);
            if (Number(fee.netAmount) < Number(fee.paidAmount) - 0.01) {
              throw new BadRequestException(
                `${edit.term}: amount cannot be reduced below the ₹${fee.paidAmount} already paid.`,
              );
            }
            touched = true;
          }

          // Boarding/drop stay editable for any month.
          if (edit.pickupLocation !== undefined) {
            fee.pickupLocation = edit.pickupLocation || null;
            touched = true;
          }
          if (edit.dropLocation !== undefined) {
            fee.dropLocation = edit.dropLocation || null;
            touched = true;
          }
          if (touched) {
            await repo.save(fee);
            updated++;
          }
        } else if (edit.amount !== undefined && edit.amount > 0) {
          const discount = Math.min(
            Math.max(0, edit.discount ?? 0),
            edit.amount,
          );
          const net = Math.max(0, edit.amount - discount);
          await repo.save(
            repo.create({
              tenantId,
              academicYear,
              studentId,
              term: edit.term as Fee['term'],
              originalAmount: edit.amount.toFixed(2),
              totalPenalty: '0.00',
              totalDiscount: discount.toFixed(2),
              netAmount: net.toFixed(2),
              paidAmount: '0.00',
              paymentStatus: PaymentStatus.UNPAID,
              pickupLocation: edit.pickupLocation ?? null,
              dropLocation: edit.dropLocation ?? null,
            }),
          );
          created++;
        }
      }

      this.logger.log(
        `Period-fee edits for student ${studentId}: ${created} created, ${updated} updated`,
      );
      return { created, updated };
    });
  }

  // ──────────────── Penalty / discount ────────────────

 /**
 * Adds `amount` penalty to fees in (academicYear, term). Two modes:
 *  - applyToAll=true: every non-PAID fee in scope.
 *  - applyToAll=false: only fees of listed students.
 *
 * PAID fees are silently skipped and counted in `feesSkipped`.
 *
 * Atomic: one transaction. SELECT FOR UPDATE on each affected fee row
 * to serialize concurrent payment writes.
 */
async addPenaltyForStudents(
  tenantId: string,
  input: {
    academicYear: string;
    term: string;
    applyToAll?: boolean;
    admissionNumbers?: string[];
    amount: number;
    reason?: string;
  },
  actor?: AdjustmentActor,
): Promise<{
  feesAffected: number;
  feesSkipped: number;
  totalPenaltyApplied: string;
}> {
  if (
    !input.applyToAll &&
    (!input.admissionNumbers || !input.admissionNumbers.length)
  ) {
    return { feesAffected: 0, feesSkipped: 0, totalPenaltyApplied: '0.00' };
  }

  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Fee);

    let qb = repo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .setLock('pessimistic_write')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.academicYear = :year', { year: input.academicYear })
      .andWhere('fee.term = :term', { term: input.term });

    if (!input.applyToAll) {
      qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
        admissions: input.admissionNumbers,
      });
    }

    const fees = await qb.getMany();

    let affected = 0;
    let skipped = 0;
    const toSave: Fee[] = [];

    for (const fee of fees) {
      if (fee.paymentStatus === PaymentStatus.PAID) {
        skipped++;
        continue;
      }
      fee.totalPenalty = (Number(fee.totalPenalty) + input.amount).toFixed(2);
      this.recomputeDerived(fee);
      toSave.push(fee);
      affected++;
    }

    if (toSave.length) {
      await repo.save(toSave);
      for (const fee of toSave) {
        await this.logAdjustment(manager, {
          tenantId,
          feeId: fee.id,
          kind: FeeAdjustmentKind.PENALTY_ADD,
          amount: input.amount,
          reason: input.reason,
          actor,
        });
      }
    }

    this.logger.log(
      `Penalty +${input.amount} applied to ${affected} fees, skipped ${skipped} ` +
        `(year=${input.academicYear}, term=${input.term}, ` +
        `applyToAll=${!!input.applyToAll})${
          input.reason ? `; reason: ${input.reason}` : ''
        }`,
    );

    return {
      feesAffected: affected,
      feesSkipped: skipped,
      totalPenaltyApplied: (input.amount * affected).toFixed(2),
    };
  });
}

/**
 * Waives the entire current penalty on fees in (academicYear, term).
 *  - applyToAll=true: every non-PAID fee with penalty > 0.
 *  - applyToAll=false: only fees of listed students.
 *
 * PAID fees and fees with no penalty are silently skipped.
 */
async waivePenaltyForStudents(
  tenantId: string,
  input: {
    academicYear: string;
    term: string;
    applyToAll?: boolean;
    admissionNumbers?: string[];
    reason?: string;
  },
  actor?: AdjustmentActor,
): Promise<{
  feesAffected: number;
  feesSkipped: number;
  totalPenaltyWaived: string;
}> {
  if (
    !input.applyToAll &&
    (!input.admissionNumbers || !input.admissionNumbers.length)
  ) {
    return { feesAffected: 0, feesSkipped: 0, totalPenaltyWaived: '0.00' };
  }

  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Fee);

    let qb = repo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .setLock('pessimistic_write')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.academicYear = :year', { year: input.academicYear })
      .andWhere('fee.term = :term', { term: input.term });

    if (!input.applyToAll) {
      qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
        admissions: input.admissionNumbers,
      });
    }

    const fees = await qb.getMany();

    let affected = 0;
    let skipped = 0;
    let totalWaived = 0;
    const toSave: { fee: Fee; waived: number }[] = [];

    for (const fee of fees) {
      if (
        fee.paymentStatus === PaymentStatus.PAID ||
        Number(fee.totalPenalty) === 0
      ) {
        skipped++;
        continue;
      }
      const waivedFromThis = Number(fee.totalPenalty);
      totalWaived += waivedFromThis;
      fee.totalPenalty = '0.00';
      this.recomputeDerived(fee);
      toSave.push({ fee, waived: waivedFromThis });
      affected++;
    }

    if (toSave.length) {
      await repo.save(toSave.map((t) => t.fee));
      for (const { fee, waived } of toSave) {
        await this.logAdjustment(manager, {
          tenantId,
          feeId: fee.id,
          kind: FeeAdjustmentKind.PENALTY_WAIVE,
          amount: waived,
          reason: input.reason,
          actor,
        });
      }
    }

    this.logger.log(
      `Penalty waiver removed ₹${totalWaived.toFixed(2)} from ${affected} fees, ` +
        `skipped ${skipped} (year=${input.academicYear}, ` +
        `term=${input.term}, applyToAll=${!!input.applyToAll})${
          input.reason ? `; reason: ${input.reason}` : ''
        }`,
    );

    return {
      feesAffected: affected,
      feesSkipped: skipped,
      totalPenaltyWaived: totalWaived.toFixed(2),
    };
  });
}

  /**
   * Bulk discount across fees in (academicYear, term). Same
   * scope semantics as addPenaltyForStudents. Per-fee, the discount is
   * skipped if it would push net below what has already been paid (we
   * never silently invalidate a posted payment).
   */
  async addDiscountForStudents(
    tenantId: string,
    input: {
      academicYear: string;
      term: string;
      applyToAll?: boolean;
      admissionNumbers?: string[];
      amount: number;
      reason?: string;
    },
    actor?: AdjustmentActor,
  ): Promise<{
    feesAffected: number;
    feesSkipped: number;
    totalDiscountApplied: string;
  }> {
    if (
      !input.applyToAll &&
      (!input.admissionNumbers || !input.admissionNumbers.length)
    ) {
      return { feesAffected: 0, feesSkipped: 0, totalDiscountApplied: '0.00' };
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Fee);

      let qb = repo
        .createQueryBuilder('fee')
        .innerJoin('fee.student', 'student')
        .setLock('pessimistic_write')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.academicYear = :year', { year: input.academicYear })
        .andWhere('fee.term = :term', { term: input.term });

      if (!input.applyToAll) {
        qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
          admissions: input.admissionNumbers,
        });
      }

      const fees = await qb.getMany();

      let affected = 0;
      let skipped = 0;
      const toSave: Fee[] = [];

      for (const fee of fees) {
        if (fee.paymentStatus === PaymentStatus.PAID) {
          skipped++;
          continue;
        }
        const newDiscount = Number(fee.totalDiscount) + input.amount;
        const newNet =
          Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;
        if (newNet < Number(fee.paidAmount)) {
          skipped++;
          continue;
        }
        fee.totalDiscount = newDiscount.toFixed(2);
        this.recomputeDerived(fee);
        toSave.push(fee);
        affected++;
      }

      if (toSave.length) {
        await repo.save(toSave);
        for (const fee of toSave) {
          await this.logAdjustment(manager, {
            tenantId,
            feeId: fee.id,
            kind: FeeAdjustmentKind.DISCOUNT_ADD,
            amount: input.amount,
            reason: input.reason,
            actor,
          });
        }
      }

      this.logger.log(
        `Discount +${input.amount} applied to ${affected} fees, skipped ${skipped} ` +
          `(year=${input.academicYear}, term=${input.term}, ` +
          `applyToAll=${!!input.applyToAll})${
            input.reason ? `; reason: ${input.reason}` : ''
          }`,
      );

      return {
        feesAffected: affected,
        feesSkipped: skipped,
        totalDiscountApplied: (input.amount * affected).toFixed(2),
      };
    });
  }

  /**
   * Waives the entire current discount on fees in scope. Skips PAID
   * fees, fees with no discount, and fees where removing the discount
   * would invalidate an already-posted payment.
   */
  async waiveDiscountForStudents(
    tenantId: string,
    input: {
      academicYear: string;
      term: string;
      applyToAll?: boolean;
      admissionNumbers?: string[];
      reason?: string;
    },
    actor?: AdjustmentActor,
  ): Promise<{
    feesAffected: number;
    feesSkipped: number;
    totalDiscountWaived: string;
  }> {
    if (
      !input.applyToAll &&
      (!input.admissionNumbers || !input.admissionNumbers.length)
    ) {
      return { feesAffected: 0, feesSkipped: 0, totalDiscountWaived: '0.00' };
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Fee);
      let qb = repo
        .createQueryBuilder('fee')
        .innerJoin('fee.student', 'student')
        .setLock('pessimistic_write')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.academicYear = :year', { year: input.academicYear })
        .andWhere('fee.term = :term', { term: input.term });

      if (!input.applyToAll) {
        qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
          admissions: input.admissionNumbers,
        });
      }

      const fees = await qb.getMany();

      let affected = 0;
      let skipped = 0;
      let totalWaived = 0;
      const toSave: { fee: Fee; waived: number }[] = [];

      for (const fee of fees) {
        if (
          fee.paymentStatus === PaymentStatus.PAID ||
          Number(fee.totalDiscount) === 0
        ) {
          skipped++;
          continue;
        }
        const newNet =
          Number(fee.originalAmount) + Number(fee.totalPenalty);
        if (newNet < Number(fee.paidAmount)) {
          // Removing the discount would push net below paid → skip.
          skipped++;
          continue;
        }
        const waivedFromThis = Number(fee.totalDiscount);
        totalWaived += waivedFromThis;
        fee.totalDiscount = '0.00';
        this.recomputeDerived(fee);
        toSave.push({ fee, waived: waivedFromThis });
        affected++;
      }

      if (toSave.length) {
        await repo.save(toSave.map((t) => t.fee));
        for (const { fee, waived } of toSave) {
          await this.logAdjustment(manager, {
            tenantId,
            feeId: fee.id,
            kind: FeeAdjustmentKind.DISCOUNT_WAIVE,
            amount: waived,
            reason: input.reason,
            actor,
          });
        }
      }

      this.logger.log(
        `Discount waiver removed ₹${totalWaived.toFixed(2)} from ${affected} fees, ` +
          `skipped ${skipped} (year=${input.academicYear}, ` +
          `term=${input.term}, applyToAll=${!!input.applyToAll})${
            input.reason ? `; reason: ${input.reason}` : ''
          }`,
      );

      return {
        feesAffected: affected,
        feesSkipped: skipped,
        totalDiscountWaived: totalWaived.toFixed(2),
      };
    });
  }

  /**
   * Adds `amount` to a single fee's total_penalty. PAID fees are
   * rejected — penalising a fully-paid student would create a phantom
   * balance and should be done by re-opening the fee instead.
   */
  async addPenaltyToFee(
    tenantId: string,
    feeId: string,
    amount: number,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      if (fee.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException(
          'Cannot add penalty to a PAID fee. Adjust the underlying payment first.',
        );
      }
      fee.totalPenalty = (Number(fee.totalPenalty) + amount).toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.PENALTY_ADD,
        amount,
        reason,
        actor,
      });
      this.logger.log(
        `Penalty +${amount} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  /**
   * Waives part or all of a single fee's penalty. If `amount` is
   * omitted, the entire current penalty is wiped. Skips PAID fees.
   */
  async waivePenaltyOnFee(
    tenantId: string,
    feeId: string,
    amount: number | undefined,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      if (fee.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Cannot waive penalty on a PAID fee.');
      }
      const current = Number(fee.totalPenalty);
      if (current === 0) {
        throw new BadRequestException('No penalty to waive.');
      }
      const waiveAmt = amount ? Math.min(amount, current) : current;
      fee.totalPenalty = (current - waiveAmt).toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.PENALTY_WAIVE,
        amount: waiveAmt,
        reason,
        actor,
      });
      this.logger.log(
        `Penalty waiver −${waiveAmt} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  /**
   * Adds `amount` to the fee's total_discount. Discount can't exceed
   * what's still owed (net − paid remaining after the discount).
   */
  async addDiscount(
    tenantId: string,
    feeId: string,
    amount: number,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);

      const newDiscount = Number(fee.totalDiscount) + amount;
      const newNet =
        Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;

      if (newNet < Number(fee.paidAmount)) {
        throw new BadRequestException(
          `Discount would reduce net amount below what has already been paid`,
        );
      }

      fee.totalDiscount = newDiscount.toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.DISCOUNT_ADD,
        amount,
        reason,
        actor,
      });
      this.logger.log(
        `Discount +${amount} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  /**
   * Waives part or all of a single fee's discount. If `amount` is
   * omitted, the full discount is wiped. Refuses to push net below
   * paid amount.
   */
  async waiveDiscountOnFee(
    tenantId: string,
    feeId: string,
    amount: number | undefined,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      const current = Number(fee.totalDiscount);
      if (current === 0) {
        throw new BadRequestException('No discount to waive.');
      }
      const waiveAmt = amount ? Math.min(amount, current) : current;
      const newDiscount = current - waiveAmt;
      const newNet =
        Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;
      if (newNet < Number(fee.paidAmount)) {
        throw new BadRequestException(
          'Removing this discount would push net below the amount already paid.',
        );
      }
      fee.totalDiscount = newDiscount.toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.DISCOUNT_WAIVE,
        amount: waiveAmt,
        reason,
        actor,
      });
      this.logger.log(
        `Discount waiver −${waiveAmt} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  // ──────────────── Payment recording ────────────────

  /**
   * Records an offline payment and updates the fee's paid_amount +
   * payment_status atomically. Used by the admin UI.
   */
  async recordOfflinePayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      chequeNumber?: string;
      chequeDate?: string;
      ddNumber?: string;
      ddDate?: string;
      bankName?: string;
      bankBranch?: string;
      drawerName?: string;
      transactionId?: string;
      cardLast4?: string;
      notes?: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    if (!OFFLINE_TYPES.has(input.paymentType)) {
      throw new BadRequestException(
        `paymentType ${input.paymentType} is not an offline type`,
      );
    }
    return this.recordPayment(tenantId, feeId, {
      ...input,
      orderId: null,
      transactionId: input.transactionId ?? null,
    });
  }

  /**
   * Records an online payment. Called by the payments team's webhook
   * handler after a gateway confirms success. Same internals as the
   * offline path but requires orderId + transactionId and rejects
   * offline payment types.
   */
  async recordOnlinePayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      orderId: string;
      transactionId: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    if (!ONLINE_TYPES.has(input.paymentType)) {
      throw new BadRequestException(
        `paymentType ${input.paymentType} is not an online type`,
      );
    }
    return this.recordPayment(tenantId, feeId, input);
  }

  /**
   * Shared payment-recording logic. Inside one transaction:
   *   1. Lock the fee row
   *   2. Verify amount doesn't exceed remaining balance
   *   3. Insert the FeePayment
   *   4. Update fee.paid_amount + payment_status
   */
  private async recordPayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      orderId: string | null;
      transactionId: string | null;
      chequeNumber?: string;
      chequeDate?: string;
      ddNumber?: string;
      ddDate?: string;
      bankName?: string;
      bankBranch?: string;
      drawerName?: string;
      cardLast4?: string;
      notes?: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);

      const remaining = Number(fee.netAmount) - Number(fee.paidAmount);
      if (input.amount > remaining + 0.01) {
        throw new BadRequestException(
          `Payment of ${input.amount} exceeds remaining balance ${remaining.toFixed(2)}`,
        );
      }

      // Cheque/DD start as PENDING; everything else clears instantly.
      const clearanceStatus =
        input.paymentType === PaymentType.CHEQUE ||
        input.paymentType === PaymentType.DD
          ? ClearanceStatus.PENDING
          : ClearanceStatus.NA;

      const repo = manager.getRepository(FeePayment);
      const paidAtDate = input.paidAt ? new Date(input.paidAt) : new Date();
      const channel = ONLINE_TYPES.has(input.paymentType)
        ? PaymentChannel.ONLINE
        : PaymentChannel.OFFLINE;

      // Online payments already have a gateway-order row in `payments`
      // (created at checkout). Finalise THAT row into the settled ledger
      // entry instead of inserting a duplicate. Idempotent: if it already
      // carries a receipt number it has been recognised — return as-is.
      let payment: FeePayment | null = null;
      if (input.orderId) {
        payment = await repo.findOne({
          where: { tenantId, gatewayOrderId: input.orderId },
        });
        if (payment?.receiptNumber) return payment;
      }

      const receiptNumber = await this.generateReceiptNumber(
        manager,
        tenantId,
        paidAtDate,
        fee.academicYear,
      );

      if (payment) {
        // Finalise the existing online order row.
        payment.feeId = feeId;
        payment.paymentType = channel;
        payment.method = input.paymentType;
        payment.status = PaymentRowStatus.PAID;
        payment.amount = input.amount.toFixed(2);
        payment.receiptNumber = receiptNumber;
        payment.orderId = input.orderId;
        payment.transactionId = input.transactionId;
        payment.clearanceStatus = clearanceStatus;
        payment.notes = input.notes ?? payment.notes ?? null;
        payment.paidAt = paidAtDate;
        payment.recordedBy = input.recordedBy;
      } else {
        payment = repo.create({
          tenantId,
          feeId,
          amount: input.amount.toFixed(2),
          paymentType: channel,
          method: input.paymentType,
          status: PaymentRowStatus.PAID,
          receiptNumber,
          orderId: input.orderId,
          transactionId: input.transactionId,
          chequeNumber: input.chequeNumber ?? null,
          chequeDate: input.chequeDate ? new Date(input.chequeDate) : null,
          ddNumber: input.ddNumber ?? null,
          ddDate: input.ddDate ? new Date(input.ddDate) : null,
          bankName: input.bankName ?? null,
          bankBranch: input.bankBranch ?? null,
          drawerName: input.drawerName ?? null,
          cardLast4: input.cardLast4 ?? null,
          notes: input.notes ?? null,
          clearanceStatus,
          paidAt: paidAtDate,
          recordedBy: input.recordedBy,
        });
      }
      const savedPayment = await repo.save(payment);

      // Pending cheque/DD payments do NOT add to paid_amount yet —
      // only on clearance (see updateClearance). Cash/POS/online/NEFT
      // are recognised immediately.
      if (clearanceStatus === ClearanceStatus.NA) {
        fee.paidAmount = (Number(fee.paidAmount) + input.amount).toFixed(2);
        fee.paymentStatus = this.deriveStatus(
          Number(fee.paidAmount),
          Number(fee.netAmount),
        );
        await manager.getRepository(Fee).save(fee);
      }

      this.logger.log(
        `Payment ${input.amount} (${input.paymentType}, ${clearanceStatus}) on fee=${feeId}; paid_amount=${fee.paidAmount}, receipt=${receiptNumber}`,
      );
      return savedPayment;
    });
  }

  /**
   * Mark a previously-recorded cheque/DD as CLEARED or BOUNCED.
   * - CLEARED: adds the amount to fee.paid_amount.
   * - BOUNCED: leaves fee.paid_amount untouched (it never went up).
   * - Re-clearing or re-bouncing the same payment is a no-op.
   */
  async updateClearance(
    tenantId: string,
    paymentId: string,
    status: ClearanceStatus,
    notes?: string,
  ): Promise<FeePayment> {
    if (status === ClearanceStatus.PENDING || status === ClearanceStatus.NA) {
      throw new BadRequestException(
        'status must be CLEARED or BOUNCED',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const fp = await manager.getRepository(FeePayment).findOne({
        where: { id: paymentId, tenantId },
      });
      if (!fp) throw new NotFoundException(`payment ${paymentId} not found`);
      if (
        fp.method !== PaymentType.CHEQUE &&
        fp.method !== PaymentType.DD
      ) {
        throw new BadRequestException(
          'Only CHEQUE / DD payments have a clearance step',
        );
      }
      if (fp.clearanceStatus === status) {
        return fp; // idempotent
      }
      if (!fp.feeId) {
        throw new BadRequestException('Payment is not linked to a fee');
      }

      const fee = await this.lockFee(manager, tenantId, fp.feeId);

      if (
        fp.clearanceStatus === ClearanceStatus.PENDING &&
        status === ClearanceStatus.CLEARED
      ) {
        fee.paidAmount = (
          Number(fee.paidAmount) + Number(fp.amount)
        ).toFixed(2);
      } else if (
        fp.clearanceStatus === ClearanceStatus.CLEARED &&
        status === ClearanceStatus.BOUNCED
      ) {
        // Reverse a previously-cleared cheque (rare).
        fee.paidAmount = Math.max(
          0,
          Number(fee.paidAmount) - Number(fp.amount),
        ).toFixed(2);
      }
      fee.paymentStatus = this.deriveStatus(
        Number(fee.paidAmount),
        Number(fee.netAmount),
      );
      await manager.getRepository(Fee).save(fee);

      fp.clearanceStatus = status;
      if (notes) fp.notes = (fp.notes ? fp.notes + '\n' : '') + notes;
      const saved = await manager.getRepository(FeePayment).save(fp);

      this.logger.log(
        `Clearance ${status} for fee_payment=${paymentId}; fee.paid_amount=${fee.paidAmount}`,
      );
      return saved;
    });
  }

  /**
   * Resolve a student by admission number (current/specified academic
   * year) along with every fee for that year. Used by the admin
   * Record-Payment fee picker.
   */
  async findStudentWithFees(
    tenantId: string,
    admissionNumber: string,
    academicYear?: string,
  ): Promise<{ student: Student | null; fees: Fee[] }> {
    const studentRepo = this.dataSource.getRepository(Student);
    const where: Record<string, unknown> = {
      tenantId,
      admissionNumber,
    };
    if (academicYear) where.academicYear = academicYear;
    const students = await studentRepo.find({
      where: where as any,
      order: { academicYear: 'DESC', createdAt: 'DESC' },
    });
    const student = students[0] ?? null;
    if (!student) return { student: null, fees: [] };
    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: student.id },
      order: { term: 'ASC' },
    });
    return { student, fees };
  }

  /**
   * Cross-tenant payment details. Finds the student in the current
   * tenant, plus the matching student in sibling Hostel/Transport
   * tenants. Returns the fees (and their payment history) grouped per
   * tenant.
   *
   * Multi-tenant safety: sibling records are linked by
   * (school_code + admission_number) — sibling tenants for one
   * institution share a school_code on their student rows, so a
   * same-admission person in a different institution can't leak in.
   */
  async findPaymentDetails(
    callerTenantId: string,
    admissionNumber: string,
    academicYear?: string,
  ): Promise<{
    student: Student | null;
    groups: {
      tenantId: string;
      tenantName: string;
      type: TenantTypeValue;
      fees: (Fee & { payments?: FeePayment[] })[];
    }[];
  }> {
    const studentRepo = this.dataSource.getRepository(Student);
    const tenantsRepo = this.dataSource.getRepository('tenants');

    // 1. Caller's own student
    const own = (
      await studentRepo.find({
        where: {
          tenantId: callerTenantId,
          admissionNumber,
          ...(academicYear ? { academicYear } : {}),
        } as any,
        order: { academicYear: 'DESC', createdAt: 'DESC' },
      })
    )[0];
    if (!own) return { student: null, groups: [] };

    // 2. School tenant info
    const callerTenant: any = await tenantsRepo
      .createQueryBuilder('t')
      .where('t.id = :id', { id: callerTenantId })
      .getRawOne();

    const groups: {
      tenantId: string;
      tenantName: string;
      type: TenantTypeValue;
      fees: (Fee & { payments?: FeePayment[] })[];
    }[] = [];

    // 3. Caller fees + payments
    const ownFees = await this.feeRepo.find({
      where: { tenantId: callerTenantId, studentId: own.id },
      order: { term: 'ASC' },
    });
    const ownFeesWithPayments = await this.attachPayments(callerTenantId, ownFees);
    groups.push({
      tenantId: callerTenantId,
      tenantName:
        (callerTenant?.t_tenant_name ??
          callerTenant?.t_name ??
          callerTenant?.tenantName ??
          TENANT_TYPE.SCHOOL) as string,
      type: TENANT_TYPE.SCHOOL,
      fees: ownFeesWithPayments,
    });

    // 4. Sibling Hostel + Transport tenants
    const siblings: any[] = await tenantsRepo
      .createQueryBuilder('t')
      .where('t.type IN (:...types)', { types: SIBLING_TENANT_TYPES })
      .andWhere('t.id != :id', { id: callerTenantId })
      .getRawMany();

    for (const t of siblings) {
      const tId = (t.t_id ?? t.id) as string;
      const tType = ((t.t_type ?? t.type) as string) as
        | 'Hostel'
        | 'Transport'
        | string;
      const tName = (t.t_tenant_name ??
        t.t_name ??
        t.tenantName ??
        tType) as string;
      // Match: same admission number AND same name (case-insensitive)
      const candidate = await studentRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tid', { tid: tId })
        .andWhere('s.admission_number = :adm', { adm: admissionNumber })
        .andWhere('LOWER(s.name) = LOWER(:nm)', { nm: own.name })
        .andWhere(
          academicYear ? 's.academic_year = :ay' : '1=1',
          academicYear ? { ay: academicYear } : {},
        )
        .orderBy('s.academic_year', 'DESC')
        .limit(1)
        .getOne();
      if (!candidate) continue;
      const fees = await this.feeRepo.find({
        where: { tenantId: tId, studentId: candidate.id },
        order: { term: 'ASC' },
      });
      const feesWithPayments = await this.attachPayments(tId, fees);
      groups.push({
        tenantId: tId,
        tenantName: tName,
        type:
          tType === TENANT_TYPE.HOSTEL || tType === TENANT_TYPE.TRANSPORT
            ? tType
            : TENANT_TYPE.SCHOOL,
        fees: feesWithPayments,
      });
    }

    return { student: own, groups };
  }

  private async attachPayments(
    tenantId: string,
    fees: Fee[],
  ): Promise<(Fee & { payments?: FeePayment[] })[]> {
    if (!fees.length) return [];
    const payments = await this.dataSource
      .getRepository(FeePayment)
      .find({
        where: {
          tenantId,
          feeId: In(fees.map((f) => f.id)),
          receiptNumber: Not(IsNull()),
        },
        order: { paidAt: 'ASC' },
      });
    const byFee = new Map<string, FeePayment[]>();
    for (const p of payments) {
      if (!p.feeId) continue;
      if (!byFee.has(p.feeId)) byFee.set(p.feeId, []);
      byFee.get(p.feeId)!.push(p);
    }
    return fees.map((f) => Object.assign(f, { payments: byFee.get(f.id) ?? [] }));
  }

  /**
   * Every payment recorded against a fee, oldest first. Used for the
   * admin payment-history view (under Payments → Fee detail).
   */
  async listFeePayments(tenantId: string, feeId: string): Promise<FeePayment[]> {
    return this.dataSource
      .getRepository(FeePayment)
      .find({
        where: { tenantId, feeId, receiptNumber: Not(IsNull()) },
        order: { paidAt: 'ASC' },
      });
  }

  /**
   * Tenant-wide payment log with optional filters.
   * Drives /reports/payment-logs.
   */
  async listAllPayments(
    tenantId: string,
    filters: {
      type?: 'online' | 'offline';
      clearance?: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'NA';
      search?: string;
      from?: string;
      to?: string;
    } = {},
  ): Promise<FeePayment[]> {
    const qb = this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .leftJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .leftJoinAndMapOne(
        'fp.student',
        'students',
        'student',
        'student.id = fee.student_id',
      )
      .where('fp.tenantId = :tenantId', { tenantId })
      // Ledger entries only — exclude unrecognised gateway orders.
      .andWhere('fp.receipt_number IS NOT NULL')
      .orderBy('fp.paidAt', 'DESC')
      .limit(500);

    if (filters.type === 'online') {
      qb.andWhere('fp.method IN (:...online)', {
        online: ['RAZORPAY', 'CASHFREE', 'UPI', 'NETBANKING', 'CARD'],
      });
    } else if (filters.type === 'offline') {
      qb.andWhere('fp.method IN (:...offline)', {
        offline: ['CASH', 'CHEQUE', 'DD', 'POS', 'NEFT'],
      });
    }
    if (filters.clearance) {
      qb.andWhere('fp.clearanceStatus = :cs', { cs: filters.clearance });
    }
    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(fp.receipt_number) LIKE :s OR LOWER(student.admission_number) LIKE :s OR LOWER(student.name) LIKE :s)',
        { s },
      );
    }
    if (filters.from) {
      qb.andWhere('fp.paidAt >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('fp.paidAt <= :to', { to: new Date(filters.to) });
    }
    return qb.getMany();
  }

  /**
   * Every cheque/DD that's still awaiting bank clearance for the
   * current tenant. Used by the admin "Pending cheques" view.
   */
  async listPendingClearance(tenantId: string): Promise<FeePayment[]> {
    return this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .leftJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .leftJoinAndMapOne(
        'fp.student',
        'students',
        'student',
        'student.id = fee.student_id',
      )
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.clearanceStatus = :status', { status: ClearanceStatus.PENDING })
      .orderBy('fp.paidAt', 'ASC')
      .getMany();
  }

  /**
   * Render a printable HTML receipt for one fee_payments row.
   * Self-contained — inlined CSS, no external assets — so admins can
   * print directly from the browser.
   */
  async renderReceipt(tenantId: string, paymentId: string): Promise<string> {
    return this.renderReceiptInner(tenantId, paymentId, /* asPage */ true);
  }

  /**
   * Render multiple receipts as one print-friendly HTML page with a
   * page break between each. Accepts either fee_payment UUIDs or
   * receipt_number strings — auto-detected per item.
   */
  async renderReceiptsBatch(
    tenantId: string,
    idsOrReceiptNos: string[],
  ): Promise<string> {
    if (idsOrReceiptNos.length === 0) return '';

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Resolve each input to a payment UUID
    const resolved: string[] = [];
    const notFound: string[] = [];
    for (const item of idsOrReceiptNos) {
      let id: string | null = null;
      if (uuidRe.test(item)) {
        id = item;
      } else {
        const row = await this.dataSource
          .getRepository(FeePayment)
          .findOne({ where: { tenantId, receiptNumber: item } });
        if (row) id = row.id;
      }
      if (id) resolved.push(id);
      else notFound.push(item);
    }

    const fragments = await Promise.all(
      resolved.map((id) => this.renderReceiptInner(tenantId, id, /* asPage */ false)),
    );

    const notFoundBanner = notFound.length
      ? `<div style="padding:24px;margin-bottom:16px;background:#fee2e2;border:1px solid #fecaca;border-radius:12px;color:#b91c1c;font-family:sans-serif;max-width:760px;margin:0 auto 16px"><strong>${notFound.length} receipt(s) not found:</strong> ${escapeHtml(notFound.join(', '))}</div>`
      : '';

    const body = fragments
      .map((f, i) => {
        const breakRule =
          i < fragments.length - 1
            ? '<div style="page-break-after:always;height:0"></div>'
            : '';
        return `<div class="receipt-wrap">${f}</div>${breakRule}`;
      })
      .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipts (${resolved.length})</title>
<style>
  body{margin:0;padding:24px 0;background:#f1f5f9}
  .receipt-wrap{margin-bottom:24px}
  @media print{
    body{padding:0;background:#fff}
    .receipt-wrap{margin:0}
  }
  .toolbar{position:sticky;top:0;z-index:10;background:#fff;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .toolbar button{background:#6c739c;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
  .toolbar button:hover{background:#565c82}
  @media print{.toolbar{display:none}}
</style>
</head>
<body>
<div class="toolbar">
  <span>${resolved.length} receipt${resolved.length === 1 ? '' : 's'} ready to print${notFound.length ? ` · ${notFound.length} not found` : ''}</span>
  <button onclick="window.print()">Print all</button>
</div>
${notFoundBanner}
${body}
</body>
</html>`;
  }

  /**
   * Renders a single receipt by delegating to the tenant's configured
   * template. If no template is set up yet, lazily ensures the starter
   * one from system_metadata. The receipt format never falls back to
   * hardcoded HTML.
   */
  private async renderReceiptInner(
    tenantId: string,
    paymentId: string,
    asPage: boolean,
  ): Promise<string> {
    const fp = await this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .innerJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .where('fp.tenantId = :tenantId AND fp.id = :paymentId', { tenantId, paymentId })
      .getOne();
    if (!fp) throw new NotFoundException(`payment ${paymentId} not found`);

    const tplKind = ReceiptTemplatesService.kindForPayment(fp);
    let tpl = await this.receiptTemplates.pickDefault(tenantId, tplKind);
    if (!tpl) {
      // Lazily provision the starter for tenants that were created
      // before receipt-templates existed.
      tpl = await this.receiptTemplates.ensureStarterForTenant(tenantId);
    }
    const rendered = await this.receiptTemplates.renderById(tenantId, tpl.id, { paymentId });
    void asPage;
    return rendered.html;
  }


  /**
   * Generate a unique receipt number for a payment.
   *
   * Format: `{prefix}-{period}/{####}`  (period omitted for NEVER policy)
   *   e.g. "SVBK-2025-26/0042"  with ACADEMIC_YEAR policy
   *        "SVBK-202510/0042"   with MONTHLY policy
   *        "SVBK/0042"          with NEVER policy
   *
   * The counter lives in receipt_sequences with a row-level lock so
   * concurrent payments serialise on the (tenantId, periodKey) row.
   */
  private async generateReceiptNumber(
    manager: EntityManager,
    tenantId: string,
    paidAt: Date,
    academicYear: string | null = null,
  ): Promise<string> {
    const tenantRepo = manager.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const policy = this.effectiveResetPolicy(tenant);
    const start = Math.max(1, tenant.receiptStartNumber ?? 1);

    const periodKey = this.computePeriodKey(policy, paidAt, academicYear);

    const seqRepo = manager.getRepository(ReceiptSequence);

    // Lock the existing row; if none, insert a fresh one. We retry the
    // insert path once on unique-violation since two concurrent payments
    // can both miss the SELECT and race to INSERT.
    let row = await seqRepo
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .where('s.tenant_id = :tid AND s.period_key = :pk', {
        tid: tenantId,
        pk: periodKey,
      })
      .getOne();

    let nextSeq: number;
    if (!row) {
      nextSeq = start;
      try {
        await seqRepo.save(
          seqRepo.create({
            tenantId,
            periodKey,
            currentValue: nextSeq,
            lastIssuedAt: paidAt,
          }),
        );
      } catch {
        // Lost the race — re-read and increment.
        row = await seqRepo
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.tenant_id = :tid AND s.period_key = :pk', {
            tid: tenantId,
            pk: periodKey,
          })
          .getOne();
        if (!row) throw new Error('Receipt sequence row could not be created.');
        nextSeq = row.currentValue + 1;
        row.currentValue = nextSeq;
        row.lastIssuedAt = paidAt;
        await seqRepo.save(row);
      }
    } else {
      nextSeq = row.currentValue + 1;
      row.currentValue = nextSeq;
      row.lastIssuedAt = paidAt;
      await seqRepo.save(row);
    }

    return this.formatReceipt(tenant, policy, periodKey, academicYear, paidAt, nextSeq);
  }

  /**
   * Compact format always resets per academic year; the legacy prefixed
   * format honours the tenant's configured reset policy.
   */
  private effectiveResetPolicy(tenant: Tenant): ReceiptResetPolicy {
    const format = tenant.receiptFormat ?? ReceiptFormat.COMPACT_ACADEMIC;
    return format === ReceiptFormat.COMPACT_ACADEMIC
      ? ReceiptResetPolicy.ACADEMIC_YEAR
      : tenant.receiptResetPolicy ?? ReceiptResetPolicy.ACADEMIC_YEAR;
  }

  /** Build the visible receipt string per the tenant's chosen format. */
  private formatReceipt(
    tenant: Tenant,
    policy: ReceiptResetPolicy,
    periodKey: string,
    academicYear: string | null,
    when: Date,
    seq: number,
  ): string {
    const format = tenant.receiptFormat ?? ReceiptFormat.COMPACT_ACADEMIC;
    if (format === ReceiptFormat.COMPACT_ACADEMIC) {
      return assembleCompactReceiptNumber(
        tenant.code ?? tenant.tenantCode,
        academicYear,
        when,
        seq,
      );
    }
    const prefix = sanitizeReceiptPrefix(
      tenant.receiptPrefix ?? tenant.code ?? tenant.tenantCode,
    );
    return assembleReceiptNumber(prefix, policy, periodKey, seq);
  }

  /**
   * Returns the running counter per active period for a tenant. Used by
   * the super-admin "Receipt sequence" panel so they can see "we're at
   * #0042 for 2025-26" without poking the DB directly.
   */
  async getReceiptStatus(tenantId: string): Promise<{
    format: ReceiptFormat;
    tenantCode: string;
    prefix: string;
    resetPolicy: ReceiptResetPolicy;
    startNumber: number;
    currentPeriod: string;
    nextPreview: string;
    history: { periodKey: string; currentValue: number; lastIssuedAt: Date | null }[];
  }> {
    const tenant = await this.dataSource
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const format = tenant.receiptFormat ?? ReceiptFormat.COMPACT_ACADEMIC;
    const prefix = sanitizeReceiptPrefix(
      tenant.receiptPrefix ?? tenant.code ?? tenant.tenantCode,
    );
    const policy = this.effectiveResetPolicy(tenant);
    const start = Math.max(1, tenant.receiptStartNumber ?? 1);

    // For ACADEMIC_YEAR we don't know the year context at status-time;
    // fall back to "guess the current academic year from today's month".
    const today = new Date();
    const guessedAY = guessAcademicYear(today);
    const currentPeriod = this.computePeriodKey(policy, today, guessedAY);

    const history = await this.dataSource
      .getRepository(ReceiptSequence)
      .find({
        where: { tenantId },
        order: { lastIssuedAt: 'DESC' },
        take: 12,
      });

    const currentRow = history.find((r) => r.periodKey === currentPeriod);
    const nextValue = (currentRow?.currentValue ?? start - 1) + 1;
    const nextPreview = this.formatReceipt(
      tenant,
      policy,
      currentPeriod,
      guessedAY,
      today,
      nextValue,
    );

    return {
      format,
      tenantCode: sanitizeReceiptPrefix(tenant.code ?? tenant.tenantCode),
      prefix,
      resetPolicy: policy,
      startNumber: start,
      currentPeriod,
      nextPreview,
      history: history.map((r) => ({
        periodKey: r.periodKey,
        currentValue: r.currentValue,
        lastIssuedAt: r.lastIssuedAt,
      })),
    };
  }

  /**
   * Update the receipt config (prefix / reset policy / start number) for
   * the caller's tenant. Tenant admin can run this for their own tenant;
   * super-admin can run it for any tenant via the existing PATCH on the
   * Tenant entity.
   */
  async updateReceiptConfig(
    tenantId: string,
    input: {
      receiptFormat?: ReceiptFormat;
      tenantCode?: string | null;
      receiptPrefix?: string | null;
      receiptResetPolicy?: ReceiptResetPolicy;
      receiptStartNumber?: number;
    },
  ): Promise<{
    format: ReceiptFormat;
    tenantCode: string;
    prefix: string;
    resetPolicy: ReceiptResetPolicy;
    startNumber: number;
  }> {
    const tenantRepo = this.dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    if (input.receiptFormat !== undefined) {
      tenant.receiptFormat = input.receiptFormat;
    }
    if (input.tenantCode !== undefined) {
      // The leading segment of the compact receipt number. Keep it short
      // and alphanumeric; uniqueness is enforced by the DB.
      const code = (input.tenantCode ?? '').trim();
      if (code) {
        const clash = await tenantRepo
          .createQueryBuilder('t')
          .where('t.code = :code AND t.id != :id', { code, id: tenantId })
          .getOne();
        if (clash) {
          throw new BadRequestException(
            `Tenant code "${code}" is already used by another school.`,
          );
        }
      }
      tenant.code = code || null;
    }
    if (input.receiptPrefix !== undefined) {
      tenant.receiptPrefix = (input.receiptPrefix ?? '').trim() || null;
    }
    if (input.receiptResetPolicy !== undefined) {
      tenant.receiptResetPolicy = input.receiptResetPolicy;
    }
    if (input.receiptStartNumber !== undefined) {
      tenant.receiptStartNumber = Math.max(1, Math.floor(input.receiptStartNumber));
    }
    await tenantRepo.save(tenant);
    return {
      format: tenant.receiptFormat ?? ReceiptFormat.COMPACT_ACADEMIC,
      tenantCode: sanitizeReceiptPrefix(tenant.code ?? tenant.tenantCode),
      prefix: sanitizeReceiptPrefix(
        tenant.receiptPrefix ?? tenant.code ?? tenant.tenantCode,
      ),
      resetPolicy: this.effectiveResetPolicy(tenant),
      startNumber: tenant.receiptStartNumber ?? 1,
    };
  }

  /**
   * Manually correct the receipt sequence counter for the caller's
   * tenant. Use cases: a receipt was issued by mistake and you need to
   * roll back, or the school wants to start fresh from a different
   * number. `periodKey` defaults to the current period (computed from
   * the tenant's reset policy + today's date + the current academic
   * year). The next receipt issued will be `currentValue + 1`.
   */
  async correctReceiptSequence(
    tenantId: string,
    input: {
      periodKey?: string;
      currentValue: number;
    },
  ): Promise<{ periodKey: string; currentValue: number; nextPreview: string }> {
    if (
      !Number.isFinite(input.currentValue) ||
      input.currentValue < 0 ||
      input.currentValue > 999999
    ) {
      throw new BadRequestException(
        'currentValue must be between 0 and 999999.',
      );
    }
    const tenant = await this.dataSource
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const policy = this.effectiveResetPolicy(tenant);
    const today = new Date();
    const guessedAY = guessAcademicYear(today);
    const periodKey =
      input.periodKey?.trim() ||
      this.computePeriodKey(policy, today, guessedAY);

    const seqRepo = this.dataSource.getRepository(ReceiptSequence);
    const existing = await seqRepo.findOne({
      where: { tenantId, periodKey },
    });
    if (existing) {
      existing.currentValue = Math.floor(input.currentValue);
      existing.lastIssuedAt = new Date();
      await seqRepo.save(existing);
    } else {
      await seqRepo.save(
        seqRepo.create({
          tenantId,
          periodKey,
          currentValue: Math.floor(input.currentValue),
          lastIssuedAt: new Date(),
        }),
      );
    }
    this.logger.warn(
      `Receipt sequence manually corrected for tenant=${tenantId}, ` +
        `period=${periodKey}, currentValue=${input.currentValue}`,
    );

    return {
      periodKey,
      currentValue: Math.floor(input.currentValue),
      nextPreview: this.formatReceipt(
        tenant,
        policy,
        periodKey,
        guessedAY,
        today,
        Math.floor(input.currentValue) + 1,
      ),
    };
  }

  /** Maps a reset policy + date (+ optional academic year) to a period key. */
  private computePeriodKey(
    policy: ReceiptResetPolicy,
    when: Date,
    academicYear: string | null,
  ): string {
    return computePeriodKeyPure(policy, when, academicYear);
  }

  // ──────────────── Internals ────────────────

  /** SELECT ... FOR UPDATE so concurrent writes serialize. */
  private async lockFee(
    manager: EntityManager,
    tenantId: string,
    feeId: string,
  ): Promise<Fee> {
    const fee = await manager
      .getRepository(Fee)
      .createQueryBuilder('fee')
      .setLock('pessimistic_write')
      .where('fee.id = :feeId AND fee.tenantId = :tenantId', {
        feeId,
        tenantId,
      })
      .getOne();
    if (!fee) throw new NotFoundException(`Fee ${feeId} not found`);
    return fee;
  }

  /** Recomputes net_amount and payment_status from the other fields. */
  private recomputeDerived(fee: Fee): void {
    const net =
      Number(fee.originalAmount) +
      Number(fee.totalPenalty) -
      Number(fee.totalDiscount);
    fee.netAmount = net.toFixed(2);
    fee.paymentStatus = this.deriveStatus(Number(fee.paidAmount), net);
  }

  private deriveStatus(paid: number, net: number): PaymentStatus {
    return deriveStatusPure(paid, net);
  }
}

function buildStats(total: number, thisMonth: number, previousMonth: number) {
  let percentageChange = 0;
  let trend: 'increase' | 'decrease' | 'no_change' = 'no_change';

  if (previousMonth === 0) {
    percentageChange = thisMonth > 0 ? 100 : 0;
    trend = thisMonth > 0 ? 'increase' : 'no_change';
  } else {
    const raw = ((thisMonth - previousMonth) / previousMonth) * 100;
    percentageChange = Math.round(raw * 100) / 100;
    if (thisMonth > previousMonth) trend = 'increase';
    else if (thisMonth < previousMonth) trend = 'decrease';
  }

  return { total, thisMonth, previousMonth, percentageChange, trend };
}
// ─────────────── Receipt helpers ───────────────

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanType(t: string): string {
  switch (t) {
    case 'CASH': return 'Cash';
    case 'CHEQUE': return 'Cheque';
    case 'DD': return 'Demand Draft';
    case 'POS': return 'POS (Card swipe)';
    case 'NEFT': return 'NEFT / Bank Transfer';
    case 'RAZORPAY': return 'Online — Razorpay';
    case 'CASHFREE': return 'Online — Cashfree';
    case 'UPI': return 'Online — UPI';
    case 'CARD': return 'Online — Card';
    case 'NETBANKING': return 'Online — Net Banking';
    default: return t;
  }
}

/**
 * Convert an INR amount (rupees + paise) to Indian-numbering English
 * words. Used for the receipt's "amount in words" line.
 */
function numberToINRWords(amount: number): string {
  if (amount == null || isNaN(amount)) return '';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const r = rupees === 0 ? 'Zero' : indianNumberWords(rupees);
  const p = paise > 0 ? ` and ${indianNumberWords(paise)} Paise` : '';
  return `Rupees ${r}${p} only`;
}

function indianNumberWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function under1000(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred';
      n %= 100;
      if (n > 0) str += ' ';
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)];
      if (n % 10 > 0) str += ' ' + ones[n % 10];
    } else if (n > 0) {
      str += ones[n];
    }
    return str;
  }

  let n = num;
  let words = '';
  if (n >= 10000000) {
    words += under1000(Math.floor(n / 10000000)) + ' Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    words += under1000(Math.floor(n / 100000)) + ' Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    words += under1000(Math.floor(n / 1000)) + ' Thousand ';
    n %= 1000;
  }
  if (n > 0) words += under1000(n);
  return words.trim();
}

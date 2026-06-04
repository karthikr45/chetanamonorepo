import { Injectable } from '@nestjs/common';
import { FeesService } from '../fees/fees.service';
import { ParsedRow } from './utils/excel-parser.util';
import {
  validateAndNormalise,
  NormalisedRow,
  BillingContext,
} from './utils/row-validator.util';
import {
  RowStatus,
  ValidatedRow,
  ValidateUploadResponseDto,
} from './dto/upload.dto';
import { FeePeriod, MonthType } from '../fees/entities/fee.entity';
import { isPastAcademicMonth } from '../fees/fee-math';

/** Month vocabulary — used to tell a revisable month from an immutable term. */
const MONTH_SET = new Set<string>(Object.values(MonthType));

export interface ValidationOutput {
  response: ValidateUploadResponseDto;
  validRows: NormalisedRow[];
}

/**
 * Combines pure field-level validation (from `row-validator.util`) with
 * DB-based checks (duplicate within file, already-exists in fees table).
 *
 * Pure validation is unit-tested; this service stays thin.
 */
@Injectable()
export class UploadValidationService {
  constructor(private readonly feesService: FeesService) {}

  async validate(
    parsedRows: ParsedRow[],
    tenantId: string,
    schoolCode: string,
    ctx: BillingContext,
  ): Promise<ValidationOutput> {
    // Stage 1: field-level validation. The Excel "Code" column is not
    // validated — every row's schoolCode is forced to the tenant's
    // tenantCode here, so whatever the file carries is ignored and the
    // student/fee records are always stored under the tenant's code.
    const stage1 = parsedRows.map((r) => {
      const result = validateAndNormalise(r.values, ctx);
      if (result.ok) {
        for (const v of result.values) {
          v.schoolCode = schoolCode;
        }
      }
      return { rowNumber: r.rowNumber, raw: r.values, result };
    });

    // Stage 2: intra-file duplicate detection (across all expanded terms)
    const keyCount = new Map<string, number>();
    for (const s of stage1) {
      if (s.result.ok) {
        for (const v of s.result.values) {
          const k = this.feeKey(v.schoolCode, v.admissionNumber, v.academicYear, v.term);
          keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
        }
      }
    }

    // Stage 3: single query to find any already-existing fees
    const allValuesForExisting = stage1
      .filter((s) => s.result.ok)
      .flatMap((s) => (s.result as { ok: true; values: NormalisedRow[] }).values);

    const existing = await this.feesService.findExistingByKeys(
      tenantId,
      allValuesForExisting.map((r) => ({
        admissionNumber: r.admissionNumber,
        academicYear: r.academicYear,
      })),
    );

    // findExistingByKeys is scoped to the tenant's schoolCode, which is
    // also what every row above was forced to, so the keys line up.
    const existingSet = new Set(
      existing.map((e) =>
        this.feeKey(schoolCode, e.admissionNumber, e.academicYear, e.term),
      ),
    );

    // Stage 4: assemble per-row results
    const validated: ValidatedRow[] = stage1.map((s) => {
      if (!s.result.ok) {
        return {
          rowNumber: s.rowNumber,
          status: RowStatus.ERROR,
          message: s.result.errors
            .map((e) => `${e.field}: ${e.reason}`)
            .join('; '),
          isTermExists: false,
          data: s.raw,
        };
      }

      const errors: string[] = [];
      let anyTermExists = false;

      for (const v of s.result.values) {
        const key = this.feeKey(v.schoolCode, v.admissionNumber, v.academicYear, v.term);
        if ((keyCount.get(key) ?? 0) > 1) {
          errors.push(
            `Duplicate within file: ${v.term} for admission ${v.admissionNumber} (${v.academicYear}) appears more than once — keep only one row per term`,
          );
        }
        if (existingSet.has(key)) {
          const isMonth = MONTH_SET.has(v.term);
          if (isMonth && !isPastAcademicMonth(v.academicYear, v.term)) {
            // Current / upcoming month that already has a fee — allowed: the
            // upload will revise its amount. Not a failure.
          } else if (isMonth) {
            anyTermExists = true;
            errors.push(
              `${v.term} (${v.academicYear}) has already passed — its fee is locked and cannot be changed by re-uploading. Leave this month's column blank to keep it as is.`,
            );
          } else {
            anyTermExists = true;
            errors.push(
              `${v.term} already exists for admission ${v.admissionNumber} (${v.academicYear}). Term fees cannot be changed via Excel — edit it from the Students table.`,
            );
          }
        }
      }

      if (errors.length) {
        return {
          rowNumber: s.rowNumber,
          status: RowStatus.ERROR,
          message: errors.join('; '),
          isTermExists: anyTermExists,
          data: s.raw,
        };
      }

      return {
        rowNumber: s.rowNumber,
        status: RowStatus.VALID,
        message: '',
        isTermExists: false,
        data: s.raw,
      };
    });

    const counts = validated.reduce(
      (acc, r) => {
        if (r.status === RowStatus.VALID) acc.valid++;
        else acc.error++;
        return acc;
      },
      { valid: 0, error: 0 },
    );

    const validRows = stage1
      .filter((s, idx) => s.result.ok && validated[idx].status === RowStatus.VALID)
      .flatMap(
        (s) => (s.result as { ok: true; values: NormalisedRow[] }).values,
      );

    return {
      response: {
        totalRows: validated.length,
        validCount: counts.valid,
        errorCount: counts.error,
        rows: validated,
      },
      validRows,
    };
  }

  private feeKey(
    schoolCode: string,
    admission: string,
    year: string,
    term: FeePeriod,
  ): string {
    return `${schoolCode.toLowerCase()}::${admission}::${year}::${term}`;
  }
}
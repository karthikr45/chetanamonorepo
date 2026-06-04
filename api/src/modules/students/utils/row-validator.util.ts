import {
  EXCEL_COLUMNS,
  TERM_COLUMNS,
  monthFeeCol,
  monthDiscountCol,
  monthPickupCol,
  monthDropCol,
} from '../constants/excel.constants';
import { TermType, MonthType, FeePeriod } from '../../fees/entities/fee.entity';
import {
  BILLING_MODE,
  BillingModeValue,
  isTransportTenant,
} from '../../../common/constants/tenant';

export const TERM_COLUMN_TO_ENUM: Record<string, TermType> = {
  [EXCEL_COLUMNS.TERM_1]: TermType.FIRST,
  [EXCEL_COLUMNS.TERM_2]: TermType.SECOND,
  [EXCEL_COLUMNS.TERM_3]: TermType.THIRD,
  [EXCEL_COLUMNS.TERM_4]: TermType.FOURTH,
  [EXCEL_COLUMNS.TERM_5]: TermType.FIFTH,
};

const TERM_TO_DISCOUNT_COL: Record<string, string> = {
  [EXCEL_COLUMNS.TERM_1]: EXCEL_COLUMNS.TERM_1_DISCOUNT,
  [EXCEL_COLUMNS.TERM_2]: EXCEL_COLUMNS.TERM_2_DISCOUNT,
  [EXCEL_COLUMNS.TERM_3]: EXCEL_COLUMNS.TERM_3_DISCOUNT,
  [EXCEL_COLUMNS.TERM_4]: EXCEL_COLUMNS.TERM_4_DISCOUNT,
  [EXCEL_COLUMNS.TERM_5]: EXCEL_COLUMNS.TERM_5_DISCOUNT,
};

/** Academic-year months a monthly fee is billed for. */
const MONTH_VALUES = Object.values(MonthType);

export type BillingMode = BillingModeValue;

/** Tenant context that decides which fee columns a row carries. */
export interface BillingContext {
  billingMode: BillingMode;
  /** Transport tenants must supply pickup/drop locations. */
  isTransport: boolean;
}

/**
 * Resolve a tenant's effective billing context. An explicit
 * `billingMode` wins; otherwise transport tenants default to monthly
 * and everyone else to term-wise.
 */
export function resolveBillingContext(
  type: string | null | undefined,
  billingMode: string | null | undefined,
): BillingContext {
  const isTransport = isTransportTenant(type);
  const mode: BillingMode =
    billingMode === BILLING_MODE.MONTHLY ||
    billingMode === BILLING_MODE.TERM_WISE
      ? billingMode
      : isTransport
        ? BILLING_MODE.MONTHLY
        : BILLING_MODE.TERM_WISE;
  return { billingMode: mode, isTransport };
}

export interface NormalisedRow {
  schoolCode: string;
  name: string;
  email: string;
  phoneNumber: string;
  admissionNumber: string;
  class: string;
  section: string;
  rollNo: string;
  academicYear: string;
  imgUrl: string | null;
  pickupLocation: string | null;
  dropLocation: string | null;
  term: FeePeriod;
  amount: number;
  discount: number;
}

export interface FieldError {
  field: string;
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;
const ACADEMIC_YEAR_RE = /^(\d{4})-(\d{4})$/;

export type ValidationResult =
  | { ok: true; values: NormalisedRow[] }
  | { ok: false; errors: FieldError[] };

export function validateAndNormalise(
  raw: Record<string, unknown>,
  ctx: BillingContext,
): ValidationResult {
  const errors: FieldError[] = [];

  // The Excel "Code" column is informational only. The student's school
  // code is always forced to the tenant's tenantCode at validation time
  // (see UploadValidationService), so whatever the file carries here is
  // neither required nor validated.
  const schoolCode = asTrimmedString(raw[EXCEL_COLUMNS.SCHOOL_CODE]);

  const name = asTrimmedString(raw[EXCEL_COLUMNS.NAME]);
  if (!name) errors.push({ field: EXCEL_COLUMNS.NAME, reason: 'required' });

  const emailRaw = asTrimmedString(raw[EXCEL_COLUMNS.EMAIL]);
  let email = '';
  if (!emailRaw) {
    errors.push({ field: EXCEL_COLUMNS.EMAIL, reason: 'required' });
  } else if (!EMAIL_RE.test(emailRaw)) {
    errors.push({ field: EXCEL_COLUMNS.EMAIL, reason: 'invalid format' });
  } else {
    email = emailRaw.toLowerCase();
  }

  const phoneNumber = asTrimmedString(raw[EXCEL_COLUMNS.PHONE]);
  if (!phoneNumber) {
    errors.push({ field: EXCEL_COLUMNS.PHONE, reason: 'required' });
  } else if (!PHONE_RE.test(phoneNumber)) {
    errors.push({
      field: EXCEL_COLUMNS.PHONE,
      reason: 'must be 7–15 digits, optional leading +',
    });
  }

  const admissionNumber = asTrimmedString(raw[EXCEL_COLUMNS.ADMISSION]);
  if (!admissionNumber) {
    errors.push({ field: EXCEL_COLUMNS.ADMISSION, reason: 'required' });
  }

  const cls = asTrimmedString(raw[EXCEL_COLUMNS.CLASS]);
  if (!cls) errors.push({ field: EXCEL_COLUMNS.CLASS, reason: 'required' });

  const section = asTrimmedString(raw[EXCEL_COLUMNS.SECTION]);
  if (!section) {
    errors.push({ field: EXCEL_COLUMNS.SECTION, reason: 'required' });
  }

  const rollNo = asTrimmedString(raw[EXCEL_COLUMNS.ROLL_NO]);
  if (!rollNo) {
    errors.push({ field: EXCEL_COLUMNS.ROLL_NO, reason: 'required' });
  }

  const academicYear = asTrimmedString(raw[EXCEL_COLUMNS.ACADEMIC_YEAR]);
  if (!academicYear) {
    errors.push({ field: EXCEL_COLUMNS.ACADEMIC_YEAR, reason: 'required' });
  } else {
    const m = academicYear.match(ACADEMIC_YEAR_RE);
    if (!m) {
      errors.push({
        field: EXCEL_COLUMNS.ACADEMIC_YEAR,
        reason: 'must be in YYYY-YYYY format',
      });
    } else if (Number(m[2]) !== Number(m[1]) + 1) {
      errors.push({
        field: EXCEL_COLUMNS.ACADEMIC_YEAR,
        reason: 'end year must be start year + 1',
      });
    }
  }

  const imgUrl = asTrimmedString(raw[EXCEL_COLUMNS.IMG_URL]) || null;

  // Fee periods differ by billing mode: term-wise tenants carry up to
  // five term columns; monthly tenants carry one Fee (+ Discount, and for
  // transport Pickup/Drop) column per academic-year month. Transport
  // tenants vary the boarding/drop point month-wise, so pickup/drop are
  // collected per month — not once per student.
  const periodValues =
    ctx.billingMode === BILLING_MODE.MONTHLY
      ? collectMonthlyPeriods(raw, ctx, errors)
      : collectTermPeriods(raw, errors);

  if (errors.length || periodValues.length === 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: periodValues.map((t) => ({
      schoolCode,
      name,
      email,
      phoneNumber,
      admissionNumber,
      class: cls,
      section,
      rollNo,
      academicYear,
      imgUrl,
      pickupLocation: t.pickupLocation ?? null,
      dropLocation: t.dropLocation ?? null,
      term: t.term,
      amount: t.amount,
      discount: t.discount,
    })),
  };
}

interface PeriodValue {
  term: FeePeriod;
  amount: number;
  discount: number;
  /** Transport (monthly) only — this month's boarding / drop point. */
  pickupLocation?: string | null;
  dropLocation?: string | null;
}

/** Term-wise: one entry per non-empty term column. */
function collectTermPeriods(
  raw: Record<string, unknown>,
  errors: FieldError[],
): PeriodValue[] {
  const termHits = TERM_COLUMNS.filter((col) => {
    const v = raw[col];
    return v !== undefined && v !== null && v !== '';
  });

  if (termHits.length === 0) {
    errors.push({
      field: 'Term Fee',
      reason: 'at least one term fee column must be set',
    });
  }

  const out: PeriodValue[] = [];
  for (const termCol of termHits) {
    const term = TERM_COLUMN_TO_ENUM[termCol];
    const amount = toPositiveAmount(raw[termCol]);
    if (amount === null) {
      errors.push({ field: termCol, reason: 'must be a positive number' });
      continue;
    }
    const discountCol = TERM_TO_DISCOUNT_COL[termCol];
    const discountRaw = discountCol ? raw[discountCol] : undefined;
    const discount =
      discountRaw === undefined || discountRaw === null || discountRaw === ''
        ? 0
        : toNonNegativeAmount(discountRaw);
    if (discount === null) {
      errors.push({
        field: discountCol ?? `${termCol} Discount`,
        reason: 'must be a non-negative number',
      });
      continue;
    }
    if (discount > amount) {
      errors.push({
        field: discountCol ?? `${termCol} Discount`,
        reason: `discount (${discount}) exceeds fee (${amount})`,
      });
      continue;
    }
    out.push({ term, amount, discount });
  }
  return out;
}

/**
 * Monthly: one entry per academic-year month that carries a fee. Each month
 * has its own Fee, Discount and — for transport — Pickup/Drop columns, so
 * amounts and boarding/drop points can vary month-wise. Months left blank
 * are simply not billed.
 */
function collectMonthlyPeriods(
  raw: Record<string, unknown>,
  ctx: BillingContext,
  errors: FieldError[],
): PeriodValue[] {
  const out: PeriodValue[] = [];

  for (const month of MONTH_VALUES) {
    const feeCol = monthFeeCol(month);
    const feeRaw = raw[feeCol];
    // Blank month → not billed this month. Skip silently.
    if (feeRaw === undefined || feeRaw === null || feeRaw === '') continue;

    const amount = toPositiveAmount(feeRaw);
    if (amount === null) {
      errors.push({ field: feeCol, reason: 'must be a positive number' });
      continue;
    }

    const discountCol = monthDiscountCol(month);
    const discountRaw = raw[discountCol];
    const discount =
      discountRaw === undefined || discountRaw === null || discountRaw === ''
        ? 0
        : toNonNegativeAmount(discountRaw);
    if (discount === null) {
      errors.push({ field: discountCol, reason: 'must be a non-negative number' });
      continue;
    }
    if (discount > amount) {
      errors.push({
        field: discountCol,
        reason: `discount (${discount}) exceeds ${month} fee (${amount})`,
      });
      continue;
    }

    // Transport varies boarding/drop month-wise; required when this month
    // is billed. Non-transport monthly tenants (e.g. hostel) skip these.
    let pickupLocation: string | null = null;
    let dropLocation: string | null = null;
    if (ctx.isTransport) {
      pickupLocation = asTrimmedString(raw[monthPickupCol(month)]) || null;
      dropLocation = asTrimmedString(raw[monthDropCol(month)]) || null;
      if (!pickupLocation) {
        errors.push({ field: monthPickupCol(month), reason: 'required' });
      }
      if (!dropLocation) {
        errors.push({ field: monthDropCol(month), reason: 'required' });
      }
    }

    out.push({ term: month, amount, discount, pickupLocation, dropLocation });
  }

  if (out.length === 0) {
    errors.push({
      field: 'Monthly Fee',
      reason: 'at least one month fee column must be set',
    });
  }
  return out;
}

function toNonNegativeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

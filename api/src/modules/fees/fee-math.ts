import { ReceiptResetPolicy } from '../tenants/entities/tenant.entity';
import { PaymentStatus } from './entities/fee.entity';

const AY_RE = /^(\d{4})\D+(\d{4})$/;

/**
 * Pure money math for the fee/receipt paths. Kept dependency-free (no
 * TypeORM / Nest) so the highest-risk logic — payment status transitions
 * and receipt-number uniqueness/format — is unit-tested in isolation.
 */

/**
 * Indian academic year boundary: April 1 — March 31. Months 0-2 (Jan/
 * Feb/Mar) belong to the *previous* academic year.
 */
export function guessAcademicYear(d: Date): string {
  const year = d.getFullYear();
  const monthIdx = d.getMonth(); // 0-based; April = 3
  const startYear = monthIdx >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Period bucket a receipt sequence resets on, given the tenant policy. */
export function computePeriodKey(
  policy: ReceiptResetPolicy,
  when: Date,
  academicYear: string | null,
): string {
  if (policy === ReceiptResetPolicy.NEVER) return 'GLOBAL';
  if (policy === ReceiptResetPolicy.YEARLY) return String(when.getFullYear());
  if (policy === ReceiptResetPolicy.MONTHLY) {
    const mm = String(when.getMonth() + 1).padStart(2, '0');
    return `${when.getFullYear()}-${mm}`;
  }
  if (policy === ReceiptResetPolicy.DAILY) {
    const mm = String(when.getMonth() + 1).padStart(2, '0');
    const dd = String(when.getDate()).padStart(2, '0');
    return `${when.getFullYear()}${mm}${dd}`;
  }
  // ACADEMIC_YEAR — prefer the explicit AY from the fee row; fall back
  // to a calendar guess. Short-form "2025-26" reads better on receipts.
  const ay = academicYear ?? guessAcademicYear(when);
  const m = ay.match(/^(\d{4})\D+(\d{4})$/);
  if (!m) return ay;
  return `${m[1]}-${m[2].slice(2)}`;
}

/** Normalises a tenant's receipt prefix/code to [A-Z0-9]. */
export function sanitizeReceiptPrefix(raw: string | null | undefined): string {
  return (raw ?? 'RCP')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Compact academic-year segment for the receipt number: the last two
 * digits of the start year followed by the last two of the end year.
 * "2026-2027" → "2627". Falls back to a calendar guess when the academic
 * year is missing or unparseable.
 */
export function compactAcademicYear(
  academicYear: string | null,
  when: Date,
): string {
  const ay = academicYear ?? '';
  const m = ay.match(AY_RE);
  if (m) return `${m[1].slice(2)}${m[2].slice(2)}`;
  const g = guessAcademicYear(when).match(AY_RE)!;
  return `${g[1].slice(2)}${g[2].slice(2)}`;
}

/** Legacy receipt string: {PREFIX}[-{period}]-{####}. */
export function assembleReceiptNumber(
  prefix: string,
  policy: ReceiptResetPolicy,
  periodKey: string,
  seq: number,
): string {
  const padded = String(seq).padStart(4, '0');
  const periodSegment =
    policy === ReceiptResetPolicy.NEVER ? '' : `-${periodKey}`;
  return `${prefix}${periodSegment}-${padded}`;
}

/**
 * Compact receipt string: {tenantCode}{AAYY}{####} with no separators.
 * Tenant "2" + AY 2026-2027 + seq 1 → "226270001". Sequence pads to 4
 * digits and grows beyond that without truncation.
 */
export function assembleCompactReceiptNumber(
  tenantCode: string | null | undefined,
  academicYear: string | null,
  when: Date,
  seq: number,
): string {
  const code = sanitizeReceiptPrefix(tenantCode);
  const ay = compactAcademicYear(academicYear, when);
  const padded = String(seq).padStart(4, '0');
  return `${code}${ay}${padded}`;
}

/** UNPAID at 0, PARTIAL below net, PAID once paid covers net. */
export function deriveStatus(paid: number, net: number): PaymentStatus {
  if (paid === 0) return PaymentStatus.UNPAID;
  if (paid < net) return PaymentStatus.PARTIAL;
  return PaymentStatus.PAID;
}

/** Calendar month index (0–11) for each academic-year month name. */
const ACADEMIC_MONTH_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

/**
 * True when an academic-year month (e.g. "April" of "2026-2027") has fully
 * elapsed — it falls strictly before the current calendar month. The current
 * month and any future month return false. Non-month periods (school terms)
 * and unparseable years return false (never treated as past).
 *
 * Apr–Dec belong to the start year; Jan–Mar roll into the end year.
 */
export function isPastAcademicMonth(
  academicYear: string,
  month: string,
  now: Date = new Date(),
): boolean {
  const idx = ACADEMIC_MONTH_INDEX[month];
  if (idx === undefined) return false;
  const m = academicYear.match(/^(\d{4})-(\d{4})$/);
  if (!m) return false;
  const calYear = idx >= 3 ? Number(m[1]) : Number(m[2]);
  return (
    calYear < now.getFullYear() ||
    (calYear === now.getFullYear() && idx < now.getMonth())
  );
}

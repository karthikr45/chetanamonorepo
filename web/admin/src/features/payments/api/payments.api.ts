/** Payments admin API: list pending cheques, mark clearance, open receipt. */
import { get, patch, post } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/env";

export type OfflinePaymentType = "CASH" | "CHEQUE" | "DD" | "POS" | "NEFT";

export interface RecordOfflinePaymentBody {
  paymentType: OfflinePaymentType;
  amount: number;
  paidAt: string; // ISO
  notes?: string;
  // Cheque
  chequeNumber?: string;
  chequeDate?: string;
  // DD
  ddNumber?: string;
  ddDate?: string;
  // Bank fields (cheque/DD/NEFT)
  bankName?: string;
  bankBranch?: string;
  drawerName?: string; // cheque/DD
  // POS / NEFT
  transactionId?: string;
  cardLast4?: string;
}

export interface PendingClearancePayment {
  id: string;
  feeId: string;
  amount: string;
  paymentType: "CHEQUE" | "DD";
  receiptNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  ddNumber: string | null;
  ddDate: string | null;
  bankName: string | null;
  bankBranch: string | null;
  drawerName: string | null;
  paidAt: string;
  fee?: {
    id: string;
    term: string;
    academicYear: string;
    studentId: string;
  };
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    section: string;
    rollNo: string;
  };
}

export async function recordOfflinePaymentApi(
  feeId: string,
  body: RecordOfflinePaymentBody,
): Promise<unknown> {
  return post<unknown, RecordOfflinePaymentBody>(
    `/fees/${feeId}/offline-payment`,
    body,
  );
}

export async function listPendingClearanceApi(): Promise<PendingClearancePayment[]> {
  return get<PendingClearancePayment[]>("/fees/payments/pending-clearance");
}

export async function updateClearanceApi(
  paymentId: string,
  status: "CLEARED" | "BOUNCED",
  notes?: string,
): Promise<unknown> {
  return patch<unknown>(`/fees/payments/${paymentId}/clearance`, {
    status,
    notes,
  });
}

/** Build the receipt URL — opens in a new tab; the API returns HTML. */
export function receiptUrl(paymentId: string): string {
  return `${getApiBaseUrl()}/fees/payments/${paymentId}/receipt`;
}

/** Build a batch-receipts URL — accepts UUIDs OR receipt numbers, comma-separated. */
export function batchReceiptsUrl(idsOrReceiptNumbers: string[]): string {
  return `${getApiBaseUrl()}/fees/payments/receipts/batch?ids=${encodeURIComponent(
    idsOrReceiptNumbers.join(","),
  )}`;
}

export interface FeeRow {
  id: string;
  branch: string;
  academicYear: string;
  term: string;
  originalAmount: string;
  totalDiscount: string;
  totalPenalty: string;
  netAmount: string;
  paidAmount: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
}

export interface StudentRow {
  id: string;
  branch: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  class: string;
  section: string;
  rollNo: string;
  tcIssuedAt?: string | null;
  tcReason?: string | null;
  tcCertificateNo?: string | null;
  identityId?: string | null;
}

export async function findStudentWithFeesApi(
  admissionNumber: string,
  academicYear?: string,
): Promise<{ student: StudentRow | null; fees: FeeRow[] }> {
  const params = new URLSearchParams({ admissionNumber });
  if (academicYear) params.set("academicYear", academicYear);
  return get<{ student: StudentRow | null; fees: FeeRow[] }>(
    `/fees/by-admission?${params.toString()}`,
  );
}

export interface FeeWithPayments extends FeeRow {
  payments?: FeePaymentRow[];
}

export interface PaymentDetailsGroup {
  tenantId: string;
  tenantName: string;
  type: "School" | "Hostel" | "Transport";
  fees: FeeWithPayments[];
}

export interface PaymentDetailsResponse {
  student: StudentRow | null;
  groups: PaymentDetailsGroup[];
}

export async function findPaymentDetailsApi(
  admissionNumber: string,
  academicYear?: string,
): Promise<PaymentDetailsResponse> {
  const params = new URLSearchParams({ admissionNumber });
  if (academicYear) params.set("academicYear", academicYear);
  return get<PaymentDetailsResponse>(
    `/fees/payment-details?${params.toString()}`,
  );
}

export interface FeePaymentRow {
  id: string;
  feeId: string;
  amount: string;
  paymentType: string;
  receiptNumber: string | null;
  clearanceStatus: "PENDING" | "CLEARED" | "BOUNCED" | "NA";
  chequeNumber: string | null;
  chequeDate: string | null;
  ddNumber: string | null;
  ddDate: string | null;
  bankName: string | null;
  bankBranch: string | null;
  drawerName: string | null;
  transactionId: string | null;
  cardLast4: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
}

export async function listFeePaymentsApi(feeId: string): Promise<FeePaymentRow[]> {
  return get<FeePaymentRow[]>(`/fees/${feeId}/payments`);
}

export type FeeAdjustmentKind =
  | "PENALTY_ADD"
  | "PENALTY_WAIVE"
  | "DISCOUNT_ADD"
  | "DISCOUNT_WAIVE";

export interface FeeAdjustmentRow {
  id: string;
  feeId: string;
  kind: FeeAdjustmentKind;
  amount: string;
  reason: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export async function listFeeAdjustmentsApi(feeId: string): Promise<FeeAdjustmentRow[]> {
  return get<FeeAdjustmentRow[]>(`/fees/${feeId}/adjustments`);
}

export type ReceiptResetPolicy =
  | "NEVER"
  | "YEARLY"
  | "ACADEMIC_YEAR"
  | "MONTHLY"
  | "DAILY";

export type ReceiptFormat = "COMPACT_ACADEMIC" | "PREFIXED";

export interface ReceiptStatusResponse {
  format: ReceiptFormat;
  tenantCode: string;
  prefix: string;
  resetPolicy: ReceiptResetPolicy;
  startNumber: number;
  currentPeriod: string;
  nextPreview: string;
  history: { periodKey: string; currentValue: number; lastIssuedAt: string | null }[];
}

export async function getReceiptStatusApi(): Promise<ReceiptStatusResponse> {
  return get<ReceiptStatusResponse>("/fees/receipt-status");
}

export async function updateReceiptConfigApi(body: {
  receiptFormat?: ReceiptFormat;
  tenantCode?: string;
  receiptPrefix?: string;
  receiptResetPolicy?: ReceiptResetPolicy;
  receiptStartNumber?: number;
}): Promise<unknown> {
  return patch<unknown>("/fees/receipt-config", body);
}

export async function correctReceiptSequenceApi(body: {
  currentValue: number;
  periodKey?: string;
}): Promise<unknown> {
  return patch<unknown>("/fees/receipt-sequence", body);
}

/** Bucket the raw paymentType into "Gateway" (online) vs "Manual" (offline). */
export function paymentSourceOf(paymentType: string): "Gateway" | "Manual" {
  const t = paymentType?.toUpperCase();
  if (
    t === "RAZORPAY" ||
    t === "CASHFREE" ||
    t === "UPI" ||
    t === "NETBANKING" ||
    t === "CARD"
  ) {
    return "Gateway";
  }
  return "Manual";
}

export interface PaymentLogFilters {
  type?: "online" | "offline";
  clearance?: "PENDING" | "CLEARED" | "BOUNCED" | "NA";
  search?: string;
  from?: string;
  to?: string;
}

export interface PaymentLogRow extends FeePaymentRow {
  branch: string;
  fee?: { id: string; term: string; academicYear: string };
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    section: string;
    rollNo: string;
  };
}

export async function listAllPaymentsApi(
  filters: PaymentLogFilters = {},
): Promise<PaymentLogRow[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.clearance) params.set("clearance", filters.clearance);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return get<PaymentLogRow[]>(`/fees/payments${qs ? `?${qs}` : ""}`);
}

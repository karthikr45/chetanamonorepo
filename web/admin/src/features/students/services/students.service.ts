/**
 * Students service – business logic. Calls API layer; maps response to domain types.
 */

import type { AcademicYearItem, StudentFeeRow, TermFeeItem } from "@/features/students/types";
import { getAcademicYearsApi, getStudentsDetailsByBranchApi, getStudentByAdmissionApi, createOrderApi, checkTermDetailsApi, uploadStudentDataApi, addPenaltyApi as addPenaltyRequestApi, verifyPaymentApi, CreateOrderResponse, getStudentByIdApi, updateStudentByIdApi } from "@/features/students/api/students.api";
type UploadValidationRow = Record<string, unknown>;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Parse API termFee array: [ { "1st Term Fee": { amount, paymentStatus } }, ... ] */
function parseTermFees(termFee: unknown): Record<string, TermFeeItem> {
  const out: Record<string, TermFeeItem> = {};
  if (!Array.isArray(termFee)) return out;
  for (const entry of termFee) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const key = Object.keys(entry)[0];
      const val = (entry as Record<string, unknown>)[key];
      if (key && val && typeof val === "object" && "amount" in val) {
        const v = val as { amount?: number; paidAmount?: number; penalityAmount?: number; penaltyAmount?: number; paymentStatus?: string };
        const amt = typeof v.amount === "number" ? v.amount : 0;
        out[key] = {
          amount: amt,
          originalAmount: amt,
          totalDiscount: 0,
          amountAfterDiscount: amt,
          paidAmount: typeof v.paidAmount === "number" ? v.paidAmount : 0,
          penaltyAmount: typeof (v.penalityAmount ?? v.penaltyAmount) === "number" ? (v.penalityAmount ?? v.penaltyAmount ?? 0) : 0,
          paymentStatus: typeof v.paymentStatus === "string" ? v.paymentStatus : "Unpaid",
        };
      }
    }
  }
  return out;
}

/** Parse API fees array: [ { term, netAmount, paidAmount, totalPenalty, paymentStatus }, ... ] */
function parseFeesArray(fees: unknown): Record<string, TermFeeItem> {
  const out: Record<string, TermFeeItem> = {};
  if (!Array.isArray(fees)) return out;
  for (const item of fees) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const fee = item as Record<string, unknown>;
    const term = typeof fee.term === "string" ? fee.term : "";
    if (!term) continue;

    const amount = toNumber(fee.netAmount ?? fee.originalAmount ?? 0);
    const originalAmount = toNumber(fee.originalAmount ?? fee.netAmount ?? 0);
    const totalDiscount = toNumber(fee.totalDiscount ?? 0);
    const amountAfterDiscount = Math.max(0, originalAmount - totalDiscount);
    const paidAmount = toNumber(fee.paidAmount ?? 0);
    const penaltyAmount = toNumber(fee.totalPenalty ?? 0);
    const rawStatus = typeof fee.paymentStatus === "string" ? fee.paymentStatus : "UNPAID";
    const payments = Array.isArray(fee.payments) ? fee.payments : [];
    const paymentDates = payments
      .map((payment) => {
        if (!payment || typeof payment !== "object" || Array.isArray(payment)) return "";
        const paidAt = (payment as Record<string, unknown>).paidAt;
        return typeof paidAt === "string" ? paidAt : "";
      })
      .filter((value) => value.length > 0);
    const latestPaymentDate =
      paymentDates.length > 0 ? paymentDates.reduce((latest, current) => (current > latest ? current : latest)) : undefined;
    const paymentStatus =
      rawStatus.toUpperCase() === "PAID"
        ? "Paid"
        : rawStatus.toUpperCase() === "UNPAID"
          ? "Unpaid"
          : rawStatus;

    const feeId = typeof fee.feeId === "string" ? fee.feeId : typeof fee.id === "string" ? fee.id : undefined;
    const pickupLocation =
      (fee.pickupLocation as string | null | undefined) ??
      (fee.pickup_location as string | null | undefined) ??
      null;
    const dropLocation =
      (fee.dropLocation as string | null | undefined) ??
      (fee.drop_location as string | null | undefined) ??
      null;

    out[term] = {
      feeId,
      amount,
      originalAmount,
      totalDiscount,
      amountAfterDiscount,
      paidAmount,
      penaltyAmount,
      paymentStatus,
      paymentDate: latestPaymentDate,
      paymentDates,
      pickupLocation,
      dropLocation,
    };
  }
  return out;
}

/** Map API result item to table row (handles different backend key names) */
function mapApiResultToRow(item: Record<string, unknown>, index: number): StudentFeeRow {
  const nestedStudent =
    item.student && typeof item.student === "object" && !Array.isArray(item.student)
      ? (item.student as Record<string, unknown>)
      : null;
  const base = nestedStudent ?? item;

  const id = String(base.id ?? base.studentId ?? item.id ?? item.studentId ?? index + 1);
  const _id = String(base._id ?? base.id ?? item._id ?? item.id ?? "");
  const name = String(base.name ?? base.studentName ?? base.student_name ?? "");
  const classVal = String(base.class ?? base.className ?? base.class_name ?? "");
  const section = String(base.section ?? base.sectionName ?? base.section_name ?? "");
  const rollNo = String(base.rollNo ?? base.roll_no ?? base.rollNumber ?? base.roll ?? "");
  const admissionNumber = String(base.admissionNumber ?? base.admissionNo ?? base.admission_number ?? "");
  const phone = String(base.phone ?? base.phoneNumber ?? base.mobile ?? "");
  const email = String(base.email ?? base.emailId ?? "");
  const amount = String(item.amount ?? base.amount ?? item.feeAmount ?? "—");
  const status = (item.status === "Paid" || item.status === "Pending" ? item.status : "Pending") as "Paid" | "Pending";
  const termFees = parseTermFees(item.termFee ?? item.termFees ?? []);
  const feesArrayMap = parseFeesArray(item.fees);
  const tcIssuedAt =
    (base.tcIssuedAt as string | null | undefined) ??
    (base.tc_issued_at as string | null | undefined) ??
    null;
  const identityId =
    (base.identityId as string | null | undefined) ??
    (base.identity_id as string | null | undefined) ??
    null;
  const pickupLocation =
    (base.pickupLocation as string | null | undefined) ??
    (base.pickup_location as string | null | undefined) ??
    null;
  const dropLocation =
    (base.dropLocation as string | null | undefined) ??
    (base.drop_location as string | null | undefined) ??
    null;
  return {
    _id,
    id,
    name,
    class: classVal,
    section,
    rollNo,
    admissionNumber,
    phone,
    email,
    amount,
    status,
    tcIssuedAt,
    identityId,
    pickupLocation,
    dropLocation,
    termFees: Object.keys(termFees).length > 0 ? termFees : feesArrayMap,
  };
}

function mapStudentWithFeesToRow(payload: Record<string, unknown>): StudentFeeRow | null {
  // Backend edit/getStudentById response shape:
  // { student: {...}, fees: [{term, netAmount, paidAmount, paymentStatus, ...}, ...] }
  const unwrapped =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)
        ? (payload.result as Record<string, unknown>)
        : payload;

  const student =
    unwrapped.student && typeof unwrapped.student === "object" && !Array.isArray(unwrapped.student)
      ? (unwrapped.student as Record<string, unknown>)
      : null;
  const fees = Array.isArray(unwrapped.fees) ? unwrapped.fees : null;

  if (!student || !fees) return null;

  const feesArrayMap = parseFeesArray(fees);
  const termFees =
    Object.keys(feesArrayMap).length > 0
      ? feesArrayMap
      : parseTermFees(unwrapped.termFee ?? unwrapped.termFees ?? []);

  const id = String(student.id ?? student.studentId ?? unwrapped.id ?? unwrapped.studentId ?? "");
  const _id = String(student._id ?? student.id ?? unwrapped._id ?? unwrapped.id ?? "");

  return {
    _id,
    id,
    name: String(student.name ?? student.studentName ?? student.student_name ?? ""),
    class: String(student.class ?? student.className ?? student.class_name ?? ""),
    section: String(student.section ?? student.sectionName ?? student.section_name ?? ""),
    rollNo: String(student.rollNo ?? student.roll_no ?? student.rollNumber ?? student.roll ?? ""),
    admissionNumber: String(
      student.admissionNumber ?? student.admissionNo ?? student.admission_number ?? ""
    ),
    phone: String(student.phone ?? student.phoneNumber ?? student.mobile ?? ""),
    email: String(student.email ?? student.emailId ?? ""),
    pickupLocation:
      (student.pickupLocation as string | null | undefined) ??
      (student.pickup_location as string | null | undefined) ??
      null,
    dropLocation:
      (student.dropLocation as string | null | undefined) ??
      (student.drop_location as string | null | undefined) ??
      null,
    // UI edit form doesn't use these top-level fields for rendering inputs,
    // but they are required by StudentFeeRow type.
    amount: "—",
    status: "Pending",
    termFees,
  };
}

function extractStudentItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const items = record.items;
  if (Array.isArray(items)) return items as Record<string, unknown>[];

  const results = record.results;
  if (Array.isArray(results)) return results as Record<string, unknown>[];

  const data = record.data;
  if (data && typeof data === "object") {
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }

  return [];
}

function extractStudentPagination(payload: unknown): { page: number; totalPages: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const page = Number(record.page);
  const totalPages = Number(record.totalPages);
  if (!Number.isFinite(page) || !Number.isFinite(totalPages)) return null;
  return { page, totalPages };
}

export async function getStudentsByBranch(
  branch: string,
  academicYear: string
): Promise<StudentFeeRow[]> {
  const data = await getStudentsDetailsByBranchApi(branch, academicYear);
  const results = extractStudentItems(data);
  return results.map((item, i) => mapApiResultToRow(item, i));
}

export async function getAllStudentsByBranch(
  branch: string,
  academicYear: string,
  pageSize = 200
): Promise<StudentFeeRow[]> {
  const firstPage = await getStudentsDetailsByBranchApi(branch, academicYear, { page: 1, pageSize });
  const firstPageItems = extractStudentItems(firstPage);
  const pagination = extractStudentPagination(firstPage);
  const mappedFirstPage = firstPageItems.map((item, i) => mapApiResultToRow(item, i));

  if (!pagination || pagination.totalPages <= 1) return mappedFirstPage;

  const remainingPages = Array.from({ length: pagination.totalPages - 1 }, (_, idx) => idx + 2);
  const restResponses = await Promise.all(
    remainingPages.map((page) => getStudentsDetailsByBranchApi(branch, academicYear, { page, pageSize }))
  );

  const restRows = restResponses.flatMap((response, responseIndex) => {
    const items = extractStudentItems(response);
    return items.map((item, i) => mapApiResultToRow(item, mappedFirstPage.length + responseIndex * pageSize + i));
  });

  return [...mappedFirstPage, ...restRows];
}

function extractAcademicYears(payload: unknown): AcademicYearItem[] {
  if (Array.isArray(payload)) return payload as AcademicYearItem[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const fromData = record.data;
  if (Array.isArray(fromData)) return fromData as AcademicYearItem[];

  const fromResults = record.results;
  if (Array.isArray(fromResults)) return fromResults as AcademicYearItem[];

  const nestedDataItems =
    fromData && typeof fromData === "object"
      ? (fromData as Record<string, unknown>).items
      : undefined;
  return Array.isArray(nestedDataItems) ? (nestedDataItems as AcademicYearItem[]) : [];
}

export async function getAcademicYears(): Promise<AcademicYearItem[]> {
  const data = await getAcademicYearsApi();
  return extractAcademicYears(data);
}

export async function addPenaltyApi(
  academicYear: string,
  term: string,
  amount: number,
  payload?: { applyToAll: boolean; admissionNumbers: string[] }
): Promise<void> {
  await addPenaltyRequestApi(academicYear, term, amount, payload);
}
export async function getStudentByAdmission(
  admissionNumber: string,
  academicYear: string
): Promise<StudentFeeRow> {
  const data = await getStudentByAdmissionApi(admissionNumber, academicYear);
  const item = (data && typeof data === "object" && "result" in data)
    ? data.result as Record<string, unknown>
    : data;
  if (!item || (typeof item === "object" && Object.keys(item).length === 0)) {
    throw new Error("Student not found. Please check the admission number.");
  }
  const mapped = mapStudentWithFeesToRow(item as Record<string, unknown>);
  return mapped ?? mapApiResultToRow(item as Record<string, unknown>, 0);
}

export async function getStudentById(studentId: string): Promise<StudentFeeRow> {
  const data = await getStudentByIdApi(studentId);
  const item = (data && typeof data === "object" && "result" in data)
    ? (data.result as Record<string, unknown>)
    : data;
  if (!item || (typeof item === "object" && Object.keys(item).length === 0)) {
    throw new Error("Student not found.");
  }
  const mapped = mapStudentWithFeesToRow(item as Record<string, unknown>);
  return mapped ?? mapApiResultToRow(item as Record<string, unknown>, 0);
}

export async function updateStudentById(studentId: string, student: StudentFeeRow): Promise<StudentFeeRow> {
  const payload: Record<string, unknown> = {
    name: student.name,
    class: student.class,
    section: student.section,
    rollNo: student.rollNo,
    admissionNumber: student.admissionNumber,
    phone: student.phone,
    email: student.email,
    pickupLocation: student.pickupLocation ?? undefined,
    dropLocation: student.dropLocation ?? undefined,
    termFees: student.termFees,
  };
  const data = await updateStudentByIdApi(studentId, payload);
  const item = (data && typeof data === "object" && "result" in data)
    ? (data.result as Record<string, unknown>)
    : data;
  const mapped = mapStudentWithFeesToRow(item as Record<string, unknown>);
  return mapped ?? mapApiResultToRow(item as Record<string, unknown>, 0);
}

export async function createOrder(amount: number, admission: string, academicYear: string, term: string, currency: string, gateway: string, studentName: string, email: string, tenantId: string, paymentType: string, feeId: string, studentClass: string, rollNo: string, section: string): Promise<CreateOrderResponse> {
  const raw = (await createOrderApi(
    amount,
    admission,
    academicYear,
    term,
    currency,
    gateway,
    studentName,
    email,
    tenantId,
    paymentType,
    feeId,
    studentClass,
    rollNo,
    section
  )) as Record<string, unknown>;
  // Backend wraps in { success, data: { payment, gatewayResponse }, message }
  const inner =
    raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;
  const payment =
    inner?.payment && typeof inner.payment === "object" && !Array.isArray(inner.payment)
      ? (inner.payment as Record<string, unknown>)
      : {};
  const gatewayResponse =
    inner?.gatewayResponse && typeof inner.gatewayResponse === "object" && !Array.isArray(inner.gatewayResponse)
      ? (inner.gatewayResponse as Record<string, unknown>)
      : {};
  return {
    orderId: String(payment.gatewayOrderId ?? gatewayResponse.order_id ?? ""),
    gatewayType: (String(payment.gateway ?? gateway) as "razorpay" | "cashfree"),
    amount: Number(payment.amount ?? amount),
    currency: String(payment.currency ?? currency),
    paymentSessionId: typeof gatewayResponse.payment_session_id === "string" ? gatewayResponse.payment_session_id : undefined,
    cashfreeMode: inner?.cashfreeMode === "production" ? "production" : "sandbox",
    key: typeof raw?.key === "string" ? raw.key : undefined,
  };
}

export async function verifyPayment(data: Record<string, unknown>): Promise<void> {
  await verifyPaymentApi(data);
}

export async function checkTermDetails(file: File): Promise<UploadValidationRow[]> {
  return checkTermDetailsApi(file);
}

export async function uploadStudentData(file: File): Promise<UploadValidationRow[]> {
  return uploadStudentDataApi(file);
}

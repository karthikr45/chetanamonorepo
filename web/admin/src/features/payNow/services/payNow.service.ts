/**
 * PayNow service – business logic. Calls API layer; maps response to domain types.
 */

import type { StudentFeeRow, TermFeeItem } from "@/features/students/types";
import { getStudentWithFeesApi } from "@/features/payNow/api/payNow.api";

type ApiFeeItem = {
  feeId?: string;
  term?: string;
  originalAmount?: string;
  netAmount?: string;
  totalPenalty?: string;
  paidAmount?: string;
  remainingAmount?: string;
  paymentStatus?: string;
};

function toNum(val: string | undefined): number {
  return parseFloat(val ?? "0") || 0;
}

function normalizePaymentStatus(status: string | undefined): string {
  if (!status) return "Unpaid";
  const s = status.toUpperCase();
  if (s === "PAID") return "Paid";
  if (s === "UNPAID") return "Unpaid";
  return status;
}

function parseFeesArray(fees: unknown): Record<string, TermFeeItem> {
  const out: Record<string, TermFeeItem> = {};
  if (!Array.isArray(fees)) return out;
  for (const fee of fees as ApiFeeItem[]) {
    if (!fee?.term) continue;
    out[fee.term] = {
      amount: toNum(fee?.netAmount),
      paidAmount: toNum(fee.paidAmount),
      penaltyAmount: toNum(fee.totalPenalty),
      originalAmount: toNum(fee.originalAmount),
      paymentStatus: normalizePaymentStatus(fee.paymentStatus),
    };
  }
  return out;
}

export async function getStudentWithFees(
  admissionNumber: string,
  academicYear: string
): Promise<StudentFeeRow> {
  const raw = await getStudentWithFeesApi(admissionNumber, academicYear) as any;

  // Response shape: { data: { student: {...}, fees: [...] } }
  const inner = raw?.data ?? raw;
  const student = inner?.student ?? inner;
  const fees = inner?.fees ?? [];

  if (!student || Object.keys(student).length === 0) {
    throw new Error("Student not found. Please check the admission number.");
  }

  return {
    id: String(student.id ?? ""),
    _id: String(student._id ?? student.id ?? ""),
    name: String(student.name ?? ""),
    class: String(student.class ?? ""),
    section: String(student.section ?? ""),
    rollNo: String(student.rollNo ?? ""),
    admissionNumber: String(student.admissionNumber ?? ""),
    phone: String(student.phoneNumber ?? student.phone ?? ""),
    email: String(student.email ?? ""),
    amount: String(student.amount ?? "—"),
    status: "Pending",
    feeId: String(fees[0].feeId ?? ""),
    termFees: parseFeesArray(fees),
  };
}

/**
 * Students feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { get, post, put } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";
import type { GetStudentsDetailsResponse, StudentFeeRow, AcademicYearItem, LatestStudent } from "@/features/students/types";

type UploadValidationRow = Record<string, unknown>;
type StudentListApiResponse = {
  results?: StudentFeeRow[];
  data?: {
    items?: StudentFeeRow[];
  };
};

export async function getStudentsDetailsByBranchApi(
  branch: string,
  academicYear: string,
  options?: { page?: number; pageSize?: number }
): Promise<GetStudentsDetailsResponse | StudentListApiResponse | StudentFeeRow[]> {
  const params = new URLSearchParams({
    academicYear,
  });
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  const url = `${API_ENDPOINTS.studentsDetails.getStudentsDetailsByBranch}?${params.toString()}`;
  return get<GetStudentsDetailsResponse | StudentListApiResponse | StudentFeeRow[]>(url);
}

export async function 
getAcademicYearsApi(): Promise<AcademicYearItem[]> {
  const url = `${API_ENDPOINTS.studentsDetails.getAcademicYears}`;
  return get<AcademicYearItem[]>(url);
}

export async function addPenaltyApi(
  academicYear: string,
  term: string,
  amount: number,
  payload?: { applyToAll: boolean; admissionNumbers: string[] }
): Promise<void> {
  const url = `${API_ENDPOINTS.studentsDetails.addPenalty}`;
  return post<void>(url, {
    academicYear,
    term,
    amount,
    applyToAll: payload?.applyToAll ?? true,
    admissionNumbers: payload?.applyToAll ? [] : payload?.admissionNumbers ?? [],
  });
}

export async function waivePenaltyApi(
  academicYear: string,
  term: string,
  payload?: { applyToAll: boolean; admissionNumbers: string[] }
): Promise<void> {
  const url = `${API_ENDPOINTS.studentsDetails.waivePenalty}`;
  return post<void>(url, {
    academicYear,
    term,
    applyToAll: payload?.applyToAll ?? true,
    admissionNumbers: payload?.applyToAll ? [] : payload?.admissionNumbers ?? [],
  });
}

export async function getStudentByAdmissionApi(
  admissionNumber: string,
  academicYear: string
): Promise<Record<string, unknown>> {
  const url = `${API_ENDPOINTS.studentsDetails.getStudentByAdmission}?admission=${encodeURIComponent(admissionNumber)}&academicYear=${encodeURIComponent(academicYear)}`;
  return get<Record<string, unknown>>(url);
}

export async function getStudentByIdApi(studentId: string): Promise<Record<string, unknown>> {
  const url = `${API_ENDPOINTS.studentsDetails.getStudentById}/${encodeURIComponent(studentId)}`;
  return get<Record<string, unknown>>(url);
}

export async function updateStudentByIdApi(
  studentId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${API_ENDPOINTS.studentsDetails.updateStudentById}/${encodeURIComponent(studentId)}`;
  return put<Record<string, unknown>, Record<string, unknown>>(url, payload);
}

export type CreateOrderResponse = {
  orderId: string;
  gatewayType: "razorpay" | "cashfree";
  amount: number;
  currency: string;
  /** Cashfree: session id used to open the checkout */
  paymentSessionId?: string;
  /** Cashfree: sandbox or production — must match backend env */
  cashfreeMode?: "sandbox" | "production";
  /** Razorpay: server-side key (optional – falls back to client key if absent) */
  key?: string;
};

export async function createOrderApi(amount: number, admission: string, academicYear: string, term: string, currency: string, gateway: string, studentName: string, email: string, tenantId: string, paymentType: string, feeId: string, studentClass: string, rollNo: string, section: string): Promise<CreateOrderResponse> {
  return post<CreateOrderResponse>(API_ENDPOINTS.payments.createOrder, { amount, ADMISSION: admission, academicYear, term, currency, gateway, studentName, email, tenantId, paymentType, feeId, class: studentClass, rollNo, section });
}

export async function verifyPaymentApi(data: Record<string, unknown>): Promise<void> {
  return post<void>(API_ENDPOINTS.payments.verifyPayment, data);
}

function buildStudentUploadFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export async function checkTermDetailsApi(file: File): Promise<UploadValidationRow[]> {
  const url = `${API_ENDPOINTS.studentsDetails.checkTermDetails}`;
  const formData = buildStudentUploadFormData(file);
  return post<UploadValidationRow[]>(url, formData);
}

export async function uploadStudentDataApi(file: File): Promise<UploadValidationRow[]> {
  const url = `${API_ENDPOINTS.studentsDetails.uploadStudentData}`;
  const formData = buildStudentUploadFormData(file);
  return post<UploadValidationRow[]>(url, formData);
}

export async function getLatestStudentsApi(): Promise<LatestStudent[]> {
  return get<LatestStudent[]>(API_ENDPOINTS.studentsDetails.getLatestStudents);
}

export interface CreateStudentTermPayload {
  term: string;
  amount: number;
  discount?: number;
}

export interface CreateStudentPayload {
  /** Historically "branch" on the UI; sent to the API as `schoolCode`. */
  schoolCode?: string;
  academicYear: string;
  admissionNumber: string;
  name: string;
  email: string;
  phoneNumber: string;
  class: string;
  section: string;
  rollNo: string;
  imgUrl?: string | null;
  /**
   * Existing identity (re-admission). Omit to auto-create a new
   * identity from name/email/phone.
   */
  identityId?: string;
  terms?: CreateStudentTermPayload[];
  // ── Transport (monthly billing) ──
  pickupLocation?: string | null;
  dropLocation?: string | null;
  monthlyFee?: number;
  monthlyDiscount?: number;
}

export async function createStudentApi(payload: CreateStudentPayload): Promise<unknown> {
  return post<unknown, CreateStudentPayload>("/students", payload);
}




/**
 * PayNow feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { get } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";

export async function getStudentWithFeesApi(
  admissionNumber: string,
  academicYear: string
): Promise<unknown> {
  const url = `${API_ENDPOINTS.payNow.getStudentWithFees}?admissionNumber=${encodeURIComponent(admissionNumber)}&academicYear=${encodeURIComponent(academicYear)}`;
  return get<unknown>(url);
}

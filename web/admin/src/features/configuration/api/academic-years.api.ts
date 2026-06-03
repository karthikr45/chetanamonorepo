/** Academic years management API. */
import { del, get, patch, post } from "@/lib/api-client";

export interface AcademicYearRow {
  id: string;
  academicYear: string;
  isCurrentYear: boolean;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAcademicYearsApi(): Promise<AcademicYearRow[]> {
  return get<AcademicYearRow[]>("/academic-years");
}

export async function createAcademicYearApi(body: {
  academicYear: string;
  isCurrentYear?: boolean;
  isActive?: boolean;
}): Promise<AcademicYearRow> {
  return post<AcademicYearRow>("/academic-years", body);
}

export async function updateAcademicYearApi(
  id: string,
  body: { academicYear?: string; isCurrentYear?: boolean; isActive?: boolean },
): Promise<AcademicYearRow> {
  return patch<AcademicYearRow>(`/academic-years/${id}`, body);
}

export async function deleteAcademicYearApi(id: string): Promise<void> {
  await del(`/academic-years/${id}`);
}

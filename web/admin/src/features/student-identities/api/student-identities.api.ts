import { get, patch, post } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/env";

export interface StudentIdentity {
  id: string;
  tenantId: string;
  displayName: string;
  dateOfBirth: string | null;
  gender: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentSummary {
  id: string;
  admissionNumber: string;
  academicYear: string;
  branch: string;
  class: string;
  section: string;
  rollNo: string;
  tcIssuedAt: string | null;
  createdAt: string;
  identityId?: string | null;
}

export interface IdentityMatch {
  identity: StudentIdentity;
  enrollments: EnrollmentSummary[];
  latestAdmissionNumber: string | null;
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function searchIdentitiesApi(query: {
  name?: string;
  phone?: string;
  email?: string;
}): Promise<IdentityMatch[]> {
  const params = new URLSearchParams();
  if (query.name) params.set("name", query.name);
  if (query.phone) params.set("phone", query.phone);
  if (query.email) params.set("email", query.email);
  return unwrap<IdentityMatch[]>(
    await get(`/student-identities/search?${params.toString()}`),
  );
}

export async function getIdentityApi(id: string): Promise<IdentityMatch> {
  return unwrap<IdentityMatch>(await get(`/student-identities/${id}`));
}

export async function createIdentityApi(body: {
  displayName: string;
  primaryPhone?: string;
  primaryEmail?: string;
  dateOfBirth?: string;
  gender?: string;
  notes?: string;
}): Promise<StudentIdentity> {
  return unwrap<StudentIdentity>(await post("/student-identities", body));
}

export async function updateIdentityApi(
  id: string,
  body: Partial<{
    displayName: string;
    primaryPhone: string | null;
    primaryEmail: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    notes: string | null;
  }>,
): Promise<StudentIdentity> {
  return unwrap<StudentIdentity>(await patch(`/student-identities/${id}`, body));
}

export async function backfillIdentitiesApi(): Promise<{
  rowsBackfilled: number;
  identitiesCreated: number;
}> {
  return unwrap(await post("/student-identities/backfill", {}));
}

// ─── TC on a student row ───────────────────────────────────────────

export async function issueTcApi(
  studentRowId: string,
  body: { reason?: string; certificateNo?: string; issuedAt?: string },
): Promise<unknown> {
  return unwrap(await post(`/students/${studentRowId}/issue-tc`, body));
}

export async function revokeTcApi(studentRowId: string): Promise<unknown> {
  return unwrap(await post(`/students/${studentRowId}/revoke-tc`, {}));
}

export async function listEnrollmentsByAdmissionApi(
  admissionNumber: string,
): Promise<{ admissionNumber: string; enrollments: EnrollmentSummary[] }> {
  const params = new URLSearchParams({ admissionNumber });
  return unwrap(
    await get(`/students/by-admission/enrollments?${params.toString()}`),
  );
}

// ─── Year-based TC register (GET /students) ────────────────────────

export interface TcRosterRow {
  id: string;
  name: string;
  admissionNumber: string;
  academicYear: string;
  branch: string;
  class: string;
  section: string;
  rollNo: string;
  tcIssuedAt: string | null;
  /** Sum of unpaid balances across the student's fees for the year. */
  outstanding: number;
}

interface RawStudentRow extends Omit<TcRosterRow, "outstanding"> {
  fees?: { netAmount?: string | number; paidAmount?: string | number }[];
}

/** Printable TC document (HTML). Fetched with auth, opened as a blob. */
export function tcCertificateUrl(studentId: string): string {
  return `${getApiBaseUrl()}/students/${studentId}/tc-certificate`;
}

export interface TcRosterPage {
  items: TcRosterRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listStudentsForTcApi(query: {
  academicYear?: string;
  class?: string;
  search?: string;
  tcStatus?: "active" | "tc_issued" | "all";
  page?: number;
  pageSize?: number;
}): Promise<TcRosterPage> {
  const p = new URLSearchParams();
  if (query.academicYear) p.set("academicYear", query.academicYear);
  if (query.class) p.set("class", query.class);
  if (query.search) p.set("search", query.search);
  if (query.tcStatus) p.set("tcStatus", query.tcStatus);
  p.set("page", String(query.page ?? 1));
  p.set("pageSize", String(query.pageSize ?? 50));
  const res = unwrap<{
    items: RawStudentRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>(await get(`/students?${p.toString()}`));
  return {
    ...res,
    items: res.items.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNumber: s.admissionNumber,
      academicYear: s.academicYear,
      branch: s.branch,
      class: s.class,
      section: s.section,
      rollNo: s.rollNo,
      tcIssuedAt: s.tcIssuedAt,
      outstanding: (s.fees ?? []).reduce(
        (sum, f) =>
          sum +
          Math.max(0, Number(f.netAmount ?? 0) - Number(f.paidAmount ?? 0)),
        0,
      ),
    })),
  };
}

export interface EnrollmentOutstanding {
  studentId: string;
  admissionNumber: string;
  academicYear: string;
  branch: string;
  tcIssuedAt: string | null;
  totalOutstanding: string;
  unpaidFees: { feeId: string; term: string; remaining: string }[];
}

export interface IdentityOutstanding {
  identityId: string;
  totalOutstanding: string;
  perEnrollment: EnrollmentOutstanding[];
}

export async function getOutstandingApi(identityId: string): Promise<IdentityOutstanding> {
  return unwrap<IdentityOutstanding>(
    await get(`/student-identities/${identityId}/outstanding`),
  );
}

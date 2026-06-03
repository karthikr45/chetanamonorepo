/**
 * Reports feature – API layer. Backend wraps GET bodies in
 * { success, data, message }; export returns a raw xlsx blob.
 */
import { get, post } from "@/lib/api-client";

export type ReportType =
  | "fee-collection"
  | "outstanding-fees"
  | "payment-summary";

export interface ReportFilters {
  from?: string;
  to?: string;
  branch?: string;
  academicYear?: string;
  class?: string;
  term?: string;
}

export interface ReportResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  summary: Record<string, unknown>;
}

function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function toQuery(filters: ReportFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchReport(
  type: ReportType,
  filters: ReportFilters,
): Promise<ReportResult> {
  const res = await get<unknown>(`/reports/${type}${toQuery(filters)}`);
  return unwrap<ReportResult>(res);
}

export async function exportReport(
  type: ReportType,
  filters: ReportFilters,
): Promise<Blob> {
  return post<Blob>(
    "/reports/export",
    { type, filters },
    { responseType: "blob" },
  );
}

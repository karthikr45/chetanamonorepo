import { get, post } from "@/lib/api-client";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdjustmentApproval {
  id: string;
  tenantId: string;
  branch: string | null;
  action: string;
  status: ApprovalStatus;
  summary: string;
  payload: Record<string, unknown>;
  requestedById: string;
  requestedByEmail: string | null;
  requestedByRole: string;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  result: { ok: boolean; error?: string } | null;
  createdAt: string;
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function listApprovalsApi(
  status?: ApprovalStatus,
): Promise<AdjustmentApproval[]> {
  const qs = status ? `?status=${status}` : "";
  return unwrap<AdjustmentApproval[]>(await get(`/approvals${qs}`));
}

export async function approveApi(
  id: string,
  note?: string,
): Promise<AdjustmentApproval> {
  return unwrap<AdjustmentApproval>(
    await post(`/approvals/${id}/approve`, { note }),
  );
}

export async function rejectApi(
  id: string,
  note?: string,
): Promise<AdjustmentApproval> {
  return unwrap<AdjustmentApproval>(
    await post(`/approvals/${id}/reject`, { note }),
  );
}

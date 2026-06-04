import { del, get, patch, post } from "@/lib/api-client";

export type PenaltyAmountType = "FLAT" | "PER_DAY";
export type PenaltyTerm =
  | "1st Term Fee"
  | "2nd Term Fee"
  | "3rd Term Fee"
  | "4th Term Fee"
  | "5th Term Fee";

export interface PenaltyRuleRow {
  id: string;
  tenantId: string;
  academicYear: string | null;
  term: PenaltyTerm | null;
  triggerAfterDays: number;
  amountType: PenaltyAmountType;
  amount: string;
  maxAmount: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PenaltyRuleBody {
  academicYear?: string;
  term?: PenaltyTerm;
  triggerAfterDays: number;
  amountType: PenaltyAmountType;
  amount: number;
  maxAmount?: number;
  isActive?: boolean;
  description?: string;
}

export async function listPenaltyRulesApi(): Promise<PenaltyRuleRow[]> {
  return get<PenaltyRuleRow[]>("/penalty-rules");
}

export async function createPenaltyRuleApi(body: PenaltyRuleBody): Promise<PenaltyRuleRow> {
  return post<PenaltyRuleRow, PenaltyRuleBody>("/penalty-rules", body);
}

export async function updatePenaltyRuleApi(
  id: string,
  body: Partial<PenaltyRuleBody>,
): Promise<PenaltyRuleRow> {
  return patch<PenaltyRuleRow>(`/penalty-rules/${id}`, body);
}

export async function deletePenaltyRuleApi(id: string): Promise<void> {
  await del(`/penalty-rules/${id}`);
}

// ─── Manual apply / waive (uses existing /fees/penalty/add + waive endpoints) ───

export async function applyPenaltyManualApi(body: {
  academicYear: string;
  term: PenaltyTerm;
  amount: number;
  applyToAll?: boolean;
  admissionNumbers?: string[];
}): Promise<unknown> {
  return post<unknown>("/fees/penalty/add", body);
}

export async function waivePenaltyManualApi(body: {
  academicYear: string;
  term: PenaltyTerm;
  applyToAll?: boolean;
  admissionNumbers?: string[];
}): Promise<unknown> {
  return post<unknown>("/fees/penalty/waive", body);
}

// ─── Single-fee adjustments (used by Payment Details per-fee actions) ──────

export async function addDiscountManualApi(
  feeId: string,
  body: { amount: number; reason?: string },
): Promise<unknown> {
  return post<unknown>(`/fees/${feeId}/discount`, body);
}

export async function addPenaltyToFeeApi(
  feeId: string,
  body: { amount: number; reason?: string },
): Promise<unknown> {
  return post<unknown>(`/fees/${feeId}/penalty`, body);
}

export async function waivePenaltyOnFeeApi(
  feeId: string,
  body: { amount?: number; reason?: string },
): Promise<unknown> {
  return post<unknown>(`/fees/${feeId}/penalty/waive`, body);
}

export async function waiveDiscountOnFeeApi(
  feeId: string,
  body: { amount?: number; reason?: string },
): Promise<unknown> {
  return post<unknown>(`/fees/${feeId}/discount/waive`, body);
}

// ─── Bulk discount (mirror of penalty bulk) ────────────────────────────────

export async function applyDiscountBulkApi(body: {
  academicYear: string;
  term: PenaltyTerm;
  amount: number;
  applyToAll?: boolean;
  admissionNumbers?: string[];
  reason?: string;
}): Promise<unknown> {
  return post<unknown>("/fees/discount/add", body);
}

export async function waiveDiscountBulkApi(body: {
  academicYear: string;
  term: PenaltyTerm;
  applyToAll?: boolean;
  admissionNumbers?: string[];
  reason?: string;
}): Promise<unknown> {
  return post<unknown>("/fees/discount/waive", body);
}

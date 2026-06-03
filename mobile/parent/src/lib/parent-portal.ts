import Constants from "expo-constants";
import { api } from "./api";
import { setTokens, setParent, clearAuth, type ParentProfile } from "./auth";

/** Web parent portal base — used to hand off online payment to the
 * proven web checkout (no native gateway SDK in the app). */
export function getParentWebUrl(): string {
  return (
    (Constants.expoConfig?.extra?.parentWebUrl as string | undefined) ??
    "http://localhost:3002"
  );
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

export interface SendOtpResponse {
  message: string;
  demoMode?: boolean;
  devOtp?: string;
}

export async function sendOtp(
  email: string,
  tenantCode?: string,
): Promise<SendOtpResponse> {
  const { data } = await api.post("/parent/auth/send-otp", { email, tenantCode });
  return unwrap<SendOtpResponse>(data);
}

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  parent: ParentProfile;
}

export interface TenantChoice {
  parentId: string;
  tenantId: string;
  tenantCode: string | null;
  tenantName: string | null;
}

export interface TenantSelectionResponse {
  requiresTenantSelection: true;
  email: string;
  selectionToken: string;
  tenants: TenantChoice[];
}

export type VerifyOtpResult =
  | { kind: "tokens" }
  | { kind: "selection"; selection: TenantSelectionResponse };

async function persistSession(result: TokensResponse) {
  await setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  await setParent(result.parent);
}

export async function verifyOtp(
  email: string,
  otp: string,
  tenantCode?: string,
): Promise<VerifyOtpResult> {
  const { data } = await api.post("/parent/auth/verify-otp", {
    email,
    otp,
    tenantCode,
  });
  const result = unwrap<TokensResponse | TenantSelectionResponse>(data);
  if ("requiresTenantSelection" in result) {
    return { kind: "selection", selection: result };
  }
  await persistSession(result);
  return { kind: "tokens" };
}

export async function selectTenant(
  selectionToken: string,
  parentId: string,
): Promise<void> {
  const { data } = await api.post("/parent/auth/select-tenant", {
    selectionToken,
    parentId,
  });
  await persistSession(unwrap<TokensResponse>(data));
}

export async function logout(): Promise<void> {
  try {
    await api.post("/parent/auth/logout");
  } catch {
    // ignore
  } finally {
    await clearAuth();
  }
}

export interface DashboardChild {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    section: string;
    rollNo: string;
    academicYear: string;
    imgUrl: string | null;
  };
  feesCount: number;
  amountDue: number;
}

export interface DashboardResponse {
  children: DashboardChild[];
  summary: { totalDue: number; totalPaid: number; totalPenalty: number };
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get("/parent/dashboard");
  return unwrap<DashboardResponse>(data);
}

export interface Fee {
  id: string;
  academicYear: string;
  term: string;
  netAmount: string;
  paidAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  studentId: string;
}

export async function fetchFees(studentId?: string): Promise<Fee[]> {
  const { data } = await api.get("/parent/fees", {
    params: studentId ? { studentId } : undefined,
  });
  return unwrap<Fee[]>(data);
}

export interface Payment {
  id: string;
  feeId: string | null;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  paymentType: string;
  paidAt: string | null;
  createdAt: string;
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data } = await api.get("/parent/payments");
  return unwrap<Payment[]>(data);
}

// ── Cross-tenant payment history (matched by parent email) ──
export interface PaymentHistoryRow {
  paymentId: string;
  tenantId: string;
  tenantName: string;
  studentName: string | null;
  admissionNumber: string | null;
  academicYear: string | null;
  term: string | null;
  amount: string;
  currency: string;
  method: string | null;
  status: string;
  clearanceStatus: string;
  receiptNumber: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentHistoryResponse {
  email: string;
  totalPaid: string;
  count: number;
  payments: PaymentHistoryRow[];
}

/** Payment history for the parent across every school they're registered in. */
export async function fetchPaymentHistory(): Promise<PaymentHistoryResponse> {
  const { data } = await api.get("/parent/payments/history");
  return unwrap<PaymentHistoryResponse>(data);
}

export interface FeedPost {
  id: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  images?: { url: string }[];
}

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data } = await api.get("/social/feed?limit=40");
  const res = unwrap<FeedPost[] | { items: FeedPost[] }>(data);
  return Array.isArray(res) ? res : (res.items ?? []);
}

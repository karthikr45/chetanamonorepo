import { api } from "./api";
import { setTokens, setParent, clearAuth, type ParentProfile } from "./auth";

// API may wrap responses in { data } via TransformInterceptor. Unwrap defensively.
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

// ── Auth ─────────────────────────────────────────────────────────────
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

export interface VerifyOtpResponse {
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

function persistSession(result: VerifyOtpResponse) {
  setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  setParent(result.parent);
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
  const result = unwrap<VerifyOtpResponse | TenantSelectionResponse>(data);
  if ("requiresTenantSelection" in result) {
    return { kind: "selection", selection: result };
  }
  persistSession(result);
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
  persistSession(unwrap<VerifyOtpResponse>(data));
}

export async function logout(): Promise<void> {
  try {
    await api.post("/parent/auth/logout");
  } catch {
    // ignore — we still clear locally
  } finally {
    clearAuth();
    // Hard nav guarantees every component remounts with fresh state and
    // bypasses any stale router/route-group caching.
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }
}

// ── Portal data ──────────────────────────────────────────────────────
export interface Student {
  id: string;
  tenantId: string;
  branch: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  email: string;
  phoneNumber: string;
  class: string;
  section: string;
  rollNo: string;
  imgUrl: string | null;
}

export type FeeTerm =
  | "1st Term Fee"
  | "2nd Term Fee"
  | "3rd Term Fee"
  | "4th Term Fee";
export type FeePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface Fee {
  id: string;
  tenantId: string;
  branch: string;
  academicYear: string;
  studentId: string;
  term: FeeTerm;
  originalAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  netAmount: string;
  paidAmount: string;
  paymentStatus: FeePaymentStatus;
  createdAt: string;
  updatedAt: string;
  /** Latest receipt id for this fee, if any payment has been recorded. */
  paymentId: string | null;
}

export interface Payment {
  id: string;
  feeId: string | null;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  gatewayOrderId: string | null;
  paymentType: string;
  paidAt: string | null;
  createdAt: string;
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
  summary: {
    totalDue: number;
    totalPaid: number;
    totalPenalty: number;
    totalPendingClearance: number;
  };
}

export async function fetchMe(): Promise<ParentProfile> {
  const { data } = await api.get("/parent/me");
  return unwrap<ParentProfile>(data);
}

export async function fetchChildren(): Promise<Student[]> {
  const { data } = await api.get("/parent/students");
  return unwrap<Student[]>(data);
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get("/parent/dashboard");
  return unwrap<DashboardResponse>(data);
}

export async function fetchFees(studentId?: string): Promise<Fee[]> {
  const { data } = await api.get("/parent/fees", {
    params: studentId ? { studentId } : undefined,
  });
  return unwrap<Fee[]>(data);
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

/**
 * Full payment history for the logged-in parent across EVERY school they're
 * registered in (matched by email on the server).
 */
export async function fetchPaymentHistory(): Promise<PaymentHistoryResponse> {
  const { data } = await api.get("/parent/payments/history");
  return unwrap<PaymentHistoryResponse>(data);
}

export type Gateway = "razorpay" | "cashfree";

export interface InitiatePaymentResponse {
  payment: Payment;
  transaction: { id: string };
  gatewayResponse: Record<string, unknown>;
  // Public key of the RECEIVING tenant's gateway (the tenant that owns
  // the fee). Use this — not the parent's home-tenant key — to mount
  // the checkout widget.
  gatewayType?: string | null;
  gatewayPublicKey?: string | null;
  cashfreeMode?: "sandbox" | "production";
}

/**
 * Start an online payment. The gateway is chosen by the tenant's active
 * configuration on the server — the caller does not pass one. The created
 * payment's `gateway` field tells the UI which checkout SDK to load.
 */
export async function initiatePayment(
  feeId: string,
): Promise<InitiatePaymentResponse> {
  const { data } = await api.post("/parent/payments", { feeId });
  return unwrap<InitiatePaymentResponse>(data);
}

export interface ActivePaymentConfig {
  gatewayType: string | null;
  paymentClientId: string | null;
}

/** Public gateway key for this tenant — the secret never leaves the server. */
export async function fetchActivePaymentConfig(): Promise<ActivePaymentConfig> {
  const { data } = await api.get("/tenant-configs/active-payment");
  return unwrap<ActivePaymentConfig>(data);
}

export async function verifyParentPayment(args: {
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  signature?: string;
}): Promise<{ payment: Payment }> {
  const { data } = await api.post("/parent/payments/verify", args);
  return unwrap<{ payment: Payment }>(data);
}

// ── Full overview: every kid, school + hostel + transport ──
export interface OverviewTerm {
  feeId: string;
  term: string;
  originalAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  netAmount: string;
  paidAmount: string;
  balance: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
}
export interface OverviewPayment {
  paymentId: string;
  amount: string;
  paymentType: string;
  paidAt: string;
  receiptNumber: string | null;
  clearanceStatus: string;
  bounced: boolean;
  term: string | null;
}
export interface OverviewCategory {
  type: "School" | "Hostel" | "Transport";
  tenantId: string;
  tenantName: string;
  years: {
    academicYear: string;
    terms: OverviewTerm[];
    payments: OverviewPayment[];
  }[];
}
export interface OverviewChild {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    branch: string;
    class: string;
    section: string;
    rollNo: string;
    academicYear: string;
    imgUrl: string | null;
  };
  tc: {
    issued: boolean;
    issuedAt: string | null;
    reason: string | null;
    certificateNo: string | null;
  };
  categories: OverviewCategory[];
}

export async function fetchOverview(): Promise<{ children: OverviewChild[] }> {
  const { data } = await api.get("/parent/overview");
  return unwrap<{ children: OverviewChild[] }>(data);
}

/**
 * Generates the PDF receipt for a fee payment (the API stores it in
 * Azure) and returns its public URL for the browser to open.
 */
export async function fetchParentReceiptUrl(
  paymentId: string,
): Promise<string> {
  const { data } = await api.get(
    `/parent/payments/receipt/${encodeURIComponent(paymentId)}`,
  );
  return unwrap<{ url: string }>(data).url;
}

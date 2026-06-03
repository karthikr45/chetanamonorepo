import axios, { type AxiosInstance } from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3001/api";

// Standalone axios client — the public-pay flow is auth-free and must
// not pick up the parent JWT interceptors from `./api`.
const publicApi: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

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

export interface PublicTenantInfo {
  tenantId: string;
  logoUrl: string | null;
  gatewayType: string;
  gatewayPublicKey: string;
  academicYears: { academicYear: string; isCurrent: boolean }[];
}

export interface PublicStudent {
  name: string;
  admissionNumber: string;
  class: string | null;
  section: string | null;
  academicYear: string;
}

export interface PublicFee {
  id: string;
  term: string;
  academicYear: string;
  originalAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  netAmount: string;
  paidAmount: string;
  paymentStatus: string;
  balance: string;
  /** Latest receipt id for this fee, if any payment has been recorded. */
  feePaymentId: string | null;
}

export interface PublicFeesResponse {
  student: PublicStudent;
  fees: PublicFee[];
}

export interface PublicInitiateResponse {
  payment: {
    id: string;
    gateway: "razorpay" | "cashfree";
    gatewayOrderId: string | null;
    amount: number;
    currency: string;
  };
  transaction: { id: string };
  gatewayResponse: Record<string, unknown>;
  gatewayType: string;
  gatewayPublicKey: string;
  cashfreeMode?: "sandbox" | "production";
}

export async function fetchPublicTenant(host: string): Promise<PublicTenantInfo> {
  const { data } = await publicApi.get("/public-pay/tenant", {
    params: { host },
  });
  return unwrap<PublicTenantInfo>(data);
}

export async function fetchPublicFees(
  host: string,
  admissionNumber: string,
  academicYear: string,
): Promise<PublicFeesResponse> {
  const { data } = await publicApi.get("/public-pay/fees", {
    params: { host, admissionNumber, academicYear },
  });
  return unwrap<PublicFeesResponse>(data);
}

export async function initiatePublicPayment(
  host: string,
  feeId: string,
): Promise<PublicInitiateResponse> {
  const { data } = await publicApi.post("/public-pay/initiate", { host, feeId });
  return unwrap<PublicInitiateResponse>(data);
}

export async function verifyPublicPayment(args: {
  host: string;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  signature?: string;
}): Promise<{ payment: { id: string }; feePaymentId: string | null }> {
  const { data } = await publicApi.post("/public-pay/verify", args);
  return unwrap<{ payment: { id: string }; feePaymentId: string | null }>(data);
}

/**
 * Generates the PDF receipt for a FeePayment on this host (the API stores
 * it in Azure) and returns its public URL for the browser to open.
 */
export async function fetchPublicReceiptUrl(
  host: string,
  feePaymentId: string,
): Promise<string> {
  const { data } = await publicApi.get(
    `/public-pay/receipt/${encodeURIComponent(feePaymentId)}`,
    { params: { host } },
  );
  return unwrap<{ url: string }>(data).url;
}

export function publicApiErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

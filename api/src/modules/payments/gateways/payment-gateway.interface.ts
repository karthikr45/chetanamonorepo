export interface OrderNotes {
  admission: string;
  academicYear: string;
  term: string;
  studentName: string;
  email: string;
}

export interface GatewayOrderResult {
  gatewayOrderId: string;
  amount: number;
  currency: string;
  raw: Record<string, any>;
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;        // Razorpay: razorpay_signature | Cashfree: not used (fetches status)
}

export interface VerifyPaymentResult {
  success: boolean;
  gatewayPaymentId: string;
}

/**
 * Per-tenant credentials for a payment gateway. Loaded from the
 * tenant's active TenantConfig and passed in for every call so the
 * gateway stays stateless and tenant-agnostic.
 */
export interface GatewayCredentials {
  /** Public key / app id — shown to the browser. */
  clientId: string;
  /** Server-side secret — used to create orders and verify signatures. */
  secretKey: string;
  /**
   * Sandbox or production — driven by the active TenantConfig's
   * environment_type. Lets one school go live while another keeps
   * piloting on test keys; no env var coordination required.
   */
  mode: 'sandbox' | 'production';
}

export interface IPaymentGateway {
  createOrder(
    creds: GatewayCredentials,
    amount: number,
    currency: string,
    notes: OrderNotes,
  ): Promise<GatewayOrderResult>;
  verifyPayment(
    creds: GatewayCredentials,
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult>;
}

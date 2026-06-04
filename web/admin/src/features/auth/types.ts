export interface LoginCredentials {
  email: string;
  password: string;
}

/** User info stored in-app after login. */
export interface AuthUser {
  email: string;
  role: string;
  tenantId: string | null;
  tenantName?: string | null;
  /** Tenant service: School / Hostel / Transport. Drives the Add Student form. */
  tenantType?: string | null;
  /** term_wise | monthly (null → derived from tenantType: transport = monthly). */
  billingMode?: string | null;
  // The tenant's school code on the historical "branch" column. Used to
  // pre-fill the default branch on tenant-admin forms (Add Student, etc).
  branch: string | null;
  id: string;
}

/** Shape of `data.response` from the login/refresh endpoint (single-tenant case). */
export interface LoginApiData {
  accessToken: string;
  refreshToken: string;
  email: string;
  role: string;
  tenantId: string | null;
  tenantName?: string | null;
  tenantType?: string | null;
  billingMode?: string | null;
  id: string;
  branch?: string | null;
}

/** A tenant the signed-in user has access to. */
export interface TenantChoice {
  adminId: string;
  tenantId: string | null;
  tenantName: string | null;
  role: string;
  branch: string | null;
}

/** Payload returned when the email exists in multiple tenants. */
export interface TenantSelectionData {
  email: string;
  selectionToken: string;
  tenants: TenantChoice[];
}

/** Full API response wrapper from the backend. */
export interface LoginResponse {
  success?: boolean;
  message?: string;
  requireTenantSelection?: boolean;
  response: LoginApiData | TenantSelectionData;
  // legacy nesting used by older clients
  data?: {
    message: string;
    response: LoginApiData;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
}

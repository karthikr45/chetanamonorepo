/**
 * Single source of truth for tenant-level enums. These values mirror
 * rows in `system_metadata` (curated by super-admin) — code references
 * the canonical strings via these constants so a typo in one service
 * can't silently break another.
 *
 * Persisted columns (`tenant.type`, `tenant.billing_mode`, etc.) are
 * varchar so super-admin can curate the option list without migrations.
 * The constants below are the values code *produces* and compares
 * against; normalize external input (admin form, Excel) to these at the
 * boundary.
 */

/** Service this tenant runs. Mirrors `system_metadata` type='tenant_type'. */
export const TENANT_TYPE = {
  SCHOOL: 'School',
  HOSTEL: 'Hostel',
  TRANSPORT: 'Transport',
} as const;
export type TenantTypeValue = (typeof TENANT_TYPE)[keyof typeof TENANT_TYPE];

/** Allowed values for tenant.type, lowercased for comparison. */
export const TENANT_TYPES = Object.values(TENANT_TYPE);
export const TENANT_TYPE_LOWER: Record<string, TenantTypeValue> = {
  school: TENANT_TYPE.SCHOOL,
  hostel: TENANT_TYPE.HOSTEL,
  transport: TENANT_TYPE.TRANSPORT,
};

/** Normalise an admin-entered tenant type to the canonical casing. */
export function normaliseTenantType(input: string | null | undefined): string | null {
  if (input == null) return null;
  const lower = String(input).trim().toLowerCase();
  if (!lower) return null;
  return TENANT_TYPE_LOWER[lower] ?? input.trim();
}

export function isTransportTenant(type: string | null | undefined): boolean {
  return (type ?? '').toLowerCase() === 'transport';
}

/** Billing modes. Mirrors `system_metadata` type='billing_mode'. */
export const BILLING_MODE = {
  TERM_WISE: 'term_wise',
  MONTHLY: 'monthly',
} as const;
export type BillingModeValue = (typeof BILLING_MODE)[keyof typeof BILLING_MODE];
export const BILLING_MODES = Object.values(BILLING_MODE);

/** Service tenants whose students are typically siblings of a school. */
export const SIBLING_TENANT_TYPES: TenantTypeValue[] = [
  TENANT_TYPE.HOSTEL,
  TENANT_TYPE.TRANSPORT,
];

/**
 * Tenant codes / school codes — the registry identifier the admin
 * assigns. Uppercase letters/digits/dashes, starts with a letter,
 * 2–31 chars total. Examples: SVBK-BRD, USH-CBSE, LOGISTICS-BUS-1.
 */
export const TENANT_CODE_REGEX = /^[A-Z][A-Z0-9-]{1,30}$/;
export const SCHOOL_CODE_REGEX = TENANT_CODE_REGEX;
export const SCHOOL_CODE_MESSAGE =
  'must be 2–31 uppercase letters/digits/dashes, starting with a letter (e.g. SVBK-BRD)';

/**
 * Tenants feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { del, get, post, put } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";
import type { Tenant } from "@/features/tenants/tenantData";

export type SaveTenantPayload = Omit<Tenant, "id">;

export type TenantConfig = {
  tenantId: string;
  configName: string;
  logoUrl: string;
  receiptLogoUrl: string;
  domainUrl: string;
  privacyPolicyUrl: string;
  termsAndConditionsUrl: string;
  refundPolicyUrl: string;
  storageTab: "accessKeys" | "connectionString";
  accessKey: string;
  secretKey: string;
  bucketName: string;
  containerName: string;
  gatewayType: string;
  paymentKey: string;
  paymentSecret: string;
  paymentMode: string;
  webhookUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFromName: string;
  smtpFromEmail: string;
  smtpSecure: boolean;
};

export type SaveTenantConfigPayload = Omit<TenantConfig, "tenantId"> & { tenantId: string; id?: string };

/**
 * Maps the form payload to the upsert API body. `storageTab` is UI-only.
 * - Connection String tab → `connectionString` + `containerName` (access-key trio cleared).
 * - Access Keys tab → `accessKey`, `secretKey`, `bucketName` (connection string + container cleared).
 */
export function buildTenantConfigSaveRequestBody(payload: SaveTenantConfigPayload): Record<string, unknown> {
  const { id: _omitId, storageTab, accessKey, secretKey, bucketName, containerName, ...rest } = payload;
  if (storageTab === "connectionString") {
    return {
      ...rest,
      connectionString: accessKey,
      containerName,
      accessKey: "",
      secretKey: "",
      bucketName: "",
    };
  }
  return {
    ...rest,
    accessKey,
    secretKey,
    bucketName,
    connectionString: "",
    containerName: "",
  };
}

export async function getTenantsApi(): Promise<Tenant[]> {
  return get<Tenant[]>(API_ENDPOINTS.tenants.getTenants);
}

export async function getTenantByIdApi(id: string): Promise<Tenant> {
  return get<Tenant>(`${API_ENDPOINTS.tenants.getTenantById}/${id}`);
}

export async function saveTenantApi(payload: SaveTenantPayload): Promise<Tenant> {
  return post<Tenant>(API_ENDPOINTS.tenants.saveTenant, payload);
}

export async function saveTenantConfigApi(payload: SaveTenantConfigPayload): Promise<void> {
  return post<void>(API_ENDPOINTS.tenants.saveTenantConfig, buildTenantConfigSaveRequestBody(payload));
}

/** Shallow snake_case → camelCase for flat config objects from the API. */
function shallowSnakeToCamel<T extends Record<string, unknown>>(obj: unknown): T {
  if (!obj || typeof obj !== "object") return {} as T;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = v;
  }
  return out as T;
}

function pickStr(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function formatGatewayLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k === "razorpay") return "Razorpay";
  if (!raw.trim()) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * Maps backend tenant-config DTOs (camelCase or snake_case) into the shape the UI saves/edits.
 * Backend example: environmentType, configurationName, paymentClientId, storageAccessKey, …
 */
function mapRemoteTenantConfigToPayload(row: unknown): SaveTenantConfigPayload {
  const r = shallowSnakeToCamel(row) as Record<string, unknown>;

  const connStr = pickStr(r, ["connectionString", "storageConnectionString"]);
  const hasConn = connStr.trim() !== "";
  const storageTab: "accessKeys" | "connectionString" = hasConn ? "connectionString" : "accessKeys";
  const accessKey = hasConn ? connStr : pickStr(r, ["storageAccessKey", "accessKey", "storage_access_key"]);
  const secretKey = hasConn ? "" : pickStr(r, ["storageSecretKey", "secretKey", "storage_secret_key"]);
  const bucketName = hasConn ? "" : pickStr(r, ["storageBucketName", "bucketName", "storage_bucket_name"]);
  const containerName = hasConn
    ? pickStr(r, ["storageContainerName", "containerName", "storage_container_name"])
    : "";

  const smtpPortVal = r.smtpPort ?? r.smtp_port;
  const smtpPort = smtpPortVal == null || smtpPortVal === "" ? "" : String(smtpPortVal);

  const idRaw = r.id ?? r.configId;
  const id = idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : undefined;

  const gatewayRaw = pickStr(r, ["gatewayType", "gateway_type"]);

  return {
    ...(id ? { id } : {}),
    tenantId: pickStr(r, ["tenantId", "tenant_id"]),
    configName: pickStr(r, ["configurationName", "configName", "config_name", "name", "configuration_name"]),
    logoUrl: pickStr(r, ["logoUrl", "logo_url"]),
    receiptLogoUrl: pickStr(r, ["receiptLogoUrl", "receipt_logo_url"]),
    domainUrl: pickStr(r, ["domainUrl", "domain_url"]),
    privacyPolicyUrl: pickStr(r, ["privacyPolicyUrl", "privacy_policy_url"]),
    termsAndConditionsUrl: pickStr(r, [
      "termsAndConditionsUrl",
      "terms_and_conditions_url",
    ]),
    refundPolicyUrl: pickStr(r, ["refundPolicyUrl", "refund_policy_url"]),
    storageTab,
    accessKey,
    secretKey,
    bucketName,
    containerName,
    gatewayType: formatGatewayLabel(gatewayRaw),
    paymentKey: pickStr(r, ["paymentClientId", "paymentKey", "payment_client_id"]),
    paymentSecret: pickStr(r, ["paymentSecretKey", "paymentSecret", "payment_secret_key"]),
    paymentMode: pickStr(r, ["paymentMode", "payment_mode"]) || "test",
    webhookUrl: pickStr(r, ["paymentWebhookUrl", "webhookUrl", "payment_webhook_url"]),
    smtpHost: pickStr(r, ["smtpHost", "smtp_host"]),
    smtpPort,
    smtpUser: pickStr(r, ["smtpUser", "smtp_user"]),
    smtpPassword: pickStr(r, ["smtpPassword", "smtp_password"]),
    smtpFromName: pickStr(r, ["smtpFromName", "smtp_from_name"]),
    smtpFromEmail: pickStr(r, ["smtpFromEmail", "smtp_from_email"]),
    smtpSecure: Boolean(r.smtpSecure ?? r.smtp_secure),
  };
}

/** Stable row id from GET list items (supports camelCase / snake_case field names). */
export function getTenantConfigRecordId(c: SaveTenantConfigPayload): string | undefined {
  const r = c as unknown as Record<string, unknown>;
  for (const k of ["id", "configId", "config_id"]) {
    const v = r[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return undefined;
}

/** Accepts a raw array or common wrapper shapes from the backend. */
export function normalizeTenantConfigsResponse(data: unknown): SaveTenantConfigPayload[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const nested = o.data ?? o.configs ?? o.result ?? o.items ?? o.records ?? o.payload ?? o.list;
    if (Array.isArray(nested)) list = nested;
    else if (nested && typeof nested === "object") list = [nested];
    else if (
      typeof o.configurationName === "string" ||
      typeof o.configuration_name === "string" ||
      typeof o.configName === "string" ||
      typeof o.config_name === "string"
    )
      list = [o];
  }
  return list
    .filter((row) => row && typeof row === "object")
    .map((row) => mapRemoteTenantConfigToPayload(row));
}

/** All tenant configs for a tenant (after save, used to refresh server state). */
export async function getTenantConfigsByTenantIdApi(
  tenantId: string
): Promise<SaveTenantConfigPayload[]> {
  const raw = await get<unknown>(`${API_ENDPOINTS.tenants.getTenantConfigsByTenantId}/${tenantId}`);
  return normalizeTenantConfigsResponse(raw);
}

/** Single row from GET /api/tenant-configs/:id */
export async function getTenantConfigByIdApi(configId: string): Promise<SaveTenantConfigPayload | null> {
  const base = API_ENDPOINTS.tenants.deleteTenantConfigById;
  const raw = await get<unknown>(`${base}/${encodeURIComponent(configId)}`);
  const list = normalizeTenantConfigsResponse(raw);
  return list[0] ?? null;
}

export async function deleteTenantConfigByIdApi(configId: string): Promise<void> {
  const base = API_ENDPOINTS.tenants.deleteTenantConfigById;
  return del<void>(`${base}/${encodeURIComponent(configId)}`);
}

export async function updateTenantApi(id: string, payload: SaveTenantPayload): Promise<Tenant> {
  return put<Tenant>(`${API_ENDPOINTS.tenants.updateTenant}/${id}`, payload);
}

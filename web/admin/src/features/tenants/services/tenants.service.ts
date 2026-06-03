/**
 * Tenants service – business logic. Calls API layer; maps response to domain types.
 */

import { getTenantsApi, getTenantByIdApi, saveTenantApi, updateTenantApi, type SaveTenantPayload } from "@/features/tenants/api/tenants.api";
import type { Tenant } from "@/features/tenants/tenantData";

function normalizeTenant(raw: Tenant, fallback: Partial<Tenant> = {}): Tenant {
  return {
    id: String(raw?.id ?? fallback.id ?? ""),
    type: raw?.type ?? fallback.type ?? "",
    name: raw?.name ?? fallback.name ?? "",
    code: raw?.code ?? fallback.code ?? "",
    medium: raw?.medium ?? fallback.medium ?? "",
    boardType: raw?.boardType ?? fallback.boardType ?? "",
    tenantCode: raw?.tenantCode ?? fallback.tenantCode ?? "",
    tenantName: raw?.tenantName ?? fallback.tenantName ?? "",
    address: raw?.address ?? fallback.address ?? "",
    city: raw?.city ?? fallback.city ?? "",
    state: raw?.state ?? fallback.state ?? "",
    country: raw?.country ?? fallback.country ?? "",
    receiptPrefix: raw?.receiptPrefix ?? fallback.receiptPrefix ?? null,
    receiptResetPolicy:
      raw?.receiptResetPolicy ?? fallback.receiptResetPolicy ?? "ACADEMIC_YEAR",
    receiptStartNumber:
      raw?.receiptStartNumber ?? fallback.receiptStartNumber ?? 1,
  };
}

function unwrap<T>(data: unknown): T {
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export async function getTenantById(id: string): Promise<Tenant> {
  const data = await getTenantByIdApi(id);
  return normalizeTenant(unwrap<Tenant>(data));
}

export async function getTenants(): Promise<Tenant[]> {
  const data = await getTenantsApi();
  const list = unwrap<Tenant[]>(data);
  return Array.isArray(list) ? list : [];
}

export async function saveTenant(payload: SaveTenantPayload): Promise<Tenant> {
  const data = await saveTenantApi(payload);
  return normalizeTenant(unwrap<Tenant>(data), payload);
}

export async function updateTenant(id: string, payload: SaveTenantPayload): Promise<Tenant> {
  const data = await updateTenantApi(id, payload);
  return normalizeTenant(unwrap<Tenant>(data), { ...payload, id });
}

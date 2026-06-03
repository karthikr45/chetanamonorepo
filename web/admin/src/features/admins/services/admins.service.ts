/**
 * Admins service – business logic. Calls API layer; maps response to domain types.
 */

import { getAdminsApi, saveAdminApi, type SaveAdminPayload, type Admin } from "@/features/admins/api/admins.api";

export async function getAdmins(tenantId: string): Promise<Admin[]> {
  const data = await getAdminsApi(tenantId);

  // Normalise response — backend may return { data: [...] } or the array directly
  const list = (data && typeof data === "object" && "data" in data)
    ? (data as { data: Admin[] }).data
    : data;

  return Array.isArray(list) ? list : [];
}

export async function saveAdmin(payload: SaveAdminPayload): Promise<Admin> {
  const data = await saveAdminApi(payload);

  // Normalise response — backend may return { data: {...} } or the object directly
  const raw = (data && typeof data === "object" && "data" in data)
    ? (data as { data: Admin }).data
    : data;

  return {
    id: String(raw?.id ?? ""),
    tenantId: raw?.tenantId ?? payload.tenantId,
    firstName: raw?.firstName ?? payload.firstName,
    lastName: raw?.lastName ?? payload.lastName,
    email: raw?.email ?? payload.email,
    role: raw?.role ?? payload.role,
    branch: raw?.branch ?? payload.branch,
  };
}

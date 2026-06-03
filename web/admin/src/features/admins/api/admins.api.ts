/**
 * Admins feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { get, post } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";

export type SaveAdminPayload = {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  // mobile: string;
  role: string;
  branch: string;
  /** Optional. Backend falls back to its default seed password if omitted. */
  password?: string;
};

export type Admin = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  // mobile: string;
  role: string;
  branch: string;
};

export async function getAdminsApi(tenantId: string): Promise<Admin[]> {
  return get<Admin[]>(`${API_ENDPOINTS.admins.getAdmins}?tenantId=${tenantId}`);
}

export async function saveAdminApi(payload: SaveAdminPayload): Promise<Admin> {
  return post<Admin>(API_ENDPOINTS.admins.saveAdmin, payload);
}

import { del, get, patch, post } from "@/lib/api-client";

/**
 * Built-in roles. Custom roles (defined by super-admin via
 * system_metadata(type=admin_role)) are accepted too — the backend treats
 * `role` as a free-form string and the UI sources the dropdown options at
 * runtime.
 */
export const TENANT_USER_ROLES: { value: string; label: string; help: string }[] = [
  {
    value: "admin",
    label: "Admin",
    help: "Full tenant access including user management.",
  },
  {
    value: "fin_admin",
    label: "Finance Admin",
    help: "Fees, payments, receipts, reports.",
  },
  {
    value: "ops_admin",
    label: "Operations Admin",
    help: "Students, announcements, media. No fee write access.",
  },
];

export interface TenantUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  branch?: string | null;
  tenantId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantUserBody {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  branch?: string;
  password?: string;
}

export interface UpdateTenantUserBody {
  firstName?: string;
  lastName?: string;
  role?: string;
  branch?: string;
  password?: string;
  isActive?: boolean;
}

export async function listTenantUsersApi(): Promise<TenantUserRow[]> {
  return get<TenantUserRow[]>("/tenant-admins");
}

export async function createTenantUserApi(
  body: CreateTenantUserBody,
): Promise<TenantUserRow> {
  return post<TenantUserRow, CreateTenantUserBody>("/tenant-admins", body);
}

export async function updateTenantUserApi(
  id: string,
  body: UpdateTenantUserBody,
): Promise<TenantUserRow> {
  return patch<TenantUserRow>(`/tenant-admins/${id}`, body);
}

export async function deleteTenantUserApi(id: string): Promise<void> {
  await del(`/tenant-admins/${id}`);
}

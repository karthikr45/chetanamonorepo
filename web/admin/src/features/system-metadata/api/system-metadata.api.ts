import { del, get, patch, post } from "@/lib/api-client";

export interface SystemMetadataRow {
  id: string;
  type: string;
  value: string;
  label: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemMetadataBody {
  type: string;
  value: string;
  label?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function listSystemMetadataApi(
  filters: { type?: string; activeOnly?: boolean } = {},
): Promise<SystemMetadataRow[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.activeOnly) params.set("activeOnly", "true");
  const qs = params.toString();
  return get<SystemMetadataRow[]>(`/system-metadata${qs ? `?${qs}` : ""}`);
}

export async function listSystemMetadataTypesApi(): Promise<string[]> {
  return get<string[]>("/system-metadata/types");
}

export async function createSystemMetadataApi(
  body: SystemMetadataBody,
): Promise<SystemMetadataRow> {
  return post<SystemMetadataRow, SystemMetadataBody>("/system-metadata", body);
}

export async function updateSystemMetadataApi(
  id: string,
  body: Partial<SystemMetadataBody>,
): Promise<SystemMetadataRow> {
  return patch<SystemMetadataRow>(`/system-metadata/${id}`, body);
}

export async function deleteSystemMetadataApi(id: string): Promise<void> {
  await del(`/system-metadata/${id}`);
}

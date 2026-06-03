import { get, post } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";
import type { GetTemplatesResponse, SaveTemplatePayload, Template } from "@/features/templates/types";

export async function getTemplatesApi(adminId: string): Promise<GetTemplatesResponse | Template[]> {
  const url = `${API_ENDPOINTS.templates.getTemplates}?adminId=${adminId}`;
  return get<GetTemplatesResponse | Template[]>(url);
}

export async function saveTemplateApi(payload: SaveTemplatePayload): Promise<Template> {
  return post<Template, SaveTemplatePayload>(API_ENDPOINTS.templates.saveTemplate, payload);
}

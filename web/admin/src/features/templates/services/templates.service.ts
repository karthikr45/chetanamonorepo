import { getTemplatesApi, saveTemplateApi } from "@/features/templates/api/templates.api";
import type { Template, SaveTemplatePayload } from "@/features/templates/types";

function extractArray(raw: unknown): Template[] {
  // Direct array
  if (Array.isArray(raw)) return raw as Template[];

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    // { result: [...] }
    if (Array.isArray(obj.result)) return obj.result as Template[];

    // { results: [...] }
    if (Array.isArray(obj.results)) return obj.results as Template[];

    // { data: [...] }
    if (Array.isArray(obj.data)) return obj.data as Template[];

    // { templates: [...] }
    if (Array.isArray(obj.templates)) return obj.templates as Template[];

    // { data: { result: [...] } }
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.result)) return inner.result as Template[];
      if (Array.isArray(inner.results)) return inner.results as Template[];
      if (Array.isArray(inner.templates)) return inner.templates as Template[];
    }

    // { success, data: { response: [...] } }
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (inner.response && typeof inner.response === "object") {
        const resp = inner.response as Record<string, unknown>;
        if (Array.isArray(resp.result)) return resp.result as Template[];
        if (Array.isArray(resp.results)) return resp.results as Template[];
      }
      if (Array.isArray(inner.response)) return inner.response as Template[];
    }
  }

  return [];
}

export async function getTemplates(adminId: string): Promise<Template[]> {
  const raw = await getTemplatesApi(adminId);
  return extractArray(raw);
}

export async function getApprovedTemplates(adminId: string): Promise<Template[]> {
  const all = await getTemplates(adminId);
  return all.filter((t) => t.status === "approved");
}

export async function saveTemplate(payload: SaveTemplatePayload): Promise<Template> {
  return saveTemplateApi(payload);
}

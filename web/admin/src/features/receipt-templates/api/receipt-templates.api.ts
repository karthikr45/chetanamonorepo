import { del, get, patch, post } from "@/lib/api-client";

export type ReceiptTemplateKind = "ONLINE" | "OFFLINE" | "BOTH";

export interface ReceiptTemplate {
  id: string;
  tenantId: string;
  name: string;
  kind: ReceiptTemplateKind;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KeyGroup {
  group: string;
  keys: { key: string; label: string }[];
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function listTemplatesApi(): Promise<ReceiptTemplate[]> {
  return unwrap<ReceiptTemplate[]>(await get("/receipt-templates"));
}

export async function getTemplateApi(id: string): Promise<ReceiptTemplate> {
  return unwrap<ReceiptTemplate>(await get(`/receipt-templates/${id}`));
}

export async function getKeysApi(): Promise<KeyGroup[]> {
  return unwrap<KeyGroup[]>(await get("/receipt-templates/keys"));
}

export interface UpsertTemplateBody {
  name: string;
  kind: ReceiptTemplateKind;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

export async function createTemplateApi(
  body: UpsertTemplateBody,
): Promise<ReceiptTemplate> {
  return unwrap<ReceiptTemplate>(await post("/receipt-templates", body));
}

export async function updateTemplateApi(
  id: string,
  body: Partial<UpsertTemplateBody>,
): Promise<ReceiptTemplate> {
  return unwrap<ReceiptTemplate>(await patch(`/receipt-templates/${id}`, body));
}

export async function deleteTemplateApi(id: string): Promise<void> {
  await del(`/receipt-templates/${id}`);
}

export async function renderTemplatePreviewApi(body: {
  headerHtml?: string;
  bodyHtml?: string;
  footerHtml?: string;
  paymentId?: string;
  feeId?: string;
  sample?: boolean;
}): Promise<{ html: string }> {
  return unwrap<{ html: string }>(
    await post("/receipt-templates/render-preview", body),
  );
}

export async function renderTemplateApi(
  id: string,
  body: { paymentId?: string; feeId?: string; sample?: boolean },
): Promise<{ html: string }> {
  return unwrap<{ html: string }>(
    await post(`/receipt-templates/${id}/render`, body),
  );
}

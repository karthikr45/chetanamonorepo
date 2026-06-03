export type { Template, SaveTemplatePayload, GetTemplatesResponse } from "./types";
export { getTemplates, saveTemplate } from "./services/templates.service";
export { useFetchTemplates, useFetchApprovedTemplates } from "./hooks/useFetchTemplates";

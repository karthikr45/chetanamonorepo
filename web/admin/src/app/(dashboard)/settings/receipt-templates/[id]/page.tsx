import { ReceiptTemplateEditor } from "../ReceiptTemplateEditor";

export default async function EditReceiptTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceiptTemplateEditor templateId={id} />;
}

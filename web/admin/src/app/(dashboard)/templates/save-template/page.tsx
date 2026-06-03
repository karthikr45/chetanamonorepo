import type { Metadata } from "next";
import { SaveTemplatePageContent } from "./SaveTemplatePageContent";

export const metadata: Metadata = {
  title: "Save Template",
  description: "Create a new template",
};

export default function SaveTemplatePage() {
  return <SaveTemplatePageContent />;
}

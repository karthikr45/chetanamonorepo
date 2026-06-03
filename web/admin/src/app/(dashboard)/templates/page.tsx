import { redirect } from "next/navigation";

// Templates is merged into the unified Communications screen.
export default function TemplatesPage() {
  redirect("/announcements?tab=templates");
}

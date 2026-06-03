import { redirect } from "next/navigation";

// Save Media is merged into the unified Media screen.
export default function SaveMediaPage() {
  redirect("/media?tab=upload");
}

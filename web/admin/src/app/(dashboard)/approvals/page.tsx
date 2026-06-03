import type { Metadata } from "next";
import { ApprovalsContent } from "./ApprovalsContent";

export const metadata: Metadata = {
  title: "Approvals",
  description: "Review and approve discount / waive-off requests",
};

export default function ApprovalsPage() {
  return <ApprovalsContent />;
}

"use client";

import { PageHeader } from "@/components/layout";
import { PendingClearancePanel } from "@/app/(dashboard)/payments/PaymentsPageContent";

export function PendingChequesContent() {
  return (
    <div>
      <PageHeader
        title="Pending Cheques"
        subtitle="Cheques and DDs submitted to your branch that are still awaiting bank clearance. Mark Cleared once the funds settle, or Bounced if rejected."
      />
      <PendingClearancePanel />
    </div>
  );
}

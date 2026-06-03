"use client";

import { PageHeader } from "@/components/layout";
import { PrintReceiptsPanel } from "@/app/(dashboard)/payments/PaymentsPageContent";

export function PrintReceiptsContent() {
  return (
    <div>
      <PageHeader
        title="Print Receipts"
        subtitle="Paste one or many receipt numbers (or payment IDs) and print all of them as a single batch — your browser handles the page breaks."
      />
      <PrintReceiptsPanel />
    </div>
  );
}

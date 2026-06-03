import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceiptPageContent } from "./ReceiptPageContent";

export const metadata: Metadata = {
  title: "Payment Receipt",
  description: "View payment receipt details",
};

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-6"><div className="h-6 w-48 rounded" style={{ backgroundColor: "var(--app-divider)" }} /></div>}>
      <ReceiptPageContent />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentPageContent } from "./PaymentPageContent";

export const metadata: Metadata = {
  title: "Payment",
  description: "Complete fee payment",
};

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentSkeleton />}>
      <PaymentPageContent />
    </Suspense>
  );
}

function PaymentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg" style={{ backgroundColor: "var(--app-divider)" }} />
      <div className="animate-pulse rounded-xl border p-6" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}>
        <div className="mb-4 h-5 w-1/3 rounded" style={{ backgroundColor: "var(--app-divider)" }} />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded" style={{ backgroundColor: "var(--app-divider)", width: `${60 + i * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

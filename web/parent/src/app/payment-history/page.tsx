"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import {
  fetchPaymentHistory,
  type PaymentHistoryResponse,
  type PaymentHistoryRow,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

// Clearance / status badge colours.
const BADGE: Record<string, { bg: string; text: string }> = {
  CLEARED: { bg: "#dcfce7", text: "#15803d" },
  NA: { bg: "#dcfce7", text: "#15803d" },
  PENDING: { bg: "#fef3c7", text: "#92400e" },
  BOUNCED: { bg: "#fee2e2", text: "#b91c1c" },
};

function badgeFor(row: PaymentHistoryRow) {
  if (row.clearanceStatus === "PENDING")
    return { label: "Pending clearance", ...BADGE.PENDING };
  if (row.clearanceStatus === "BOUNCED")
    return { label: "Bounced", ...BADGE.BOUNCED };
  return { label: "Paid", ...BADGE.CLEARED };
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<PaymentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchPaymentHistory()
      .then(setData)
      .catch((err) =>
        setError(apiErrorMessage(err, "Could not load payment history.")),
      )
      .finally(() => setLoading(false));
  }, [router]);

  // Group rows by school so a parent with children in multiple schools sees
  // a clear section per school.
  const groups = useMemo(() => {
    const map = new Map<string, { tenantName: string; rows: PaymentHistoryRow[] }>();
    for (const r of data?.payments ?? []) {
      const g = map.get(r.tenantId) ?? { tenantName: r.tenantName, rows: [] };
      g.rows.push(r);
      map.set(r.tenantId, g);
    }
    return [...map.values()];
  }, [data]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
      <header className="h-16 flex items-center px-4 sm:px-6 gap-4 bg-white border-b border-slate-200 sticky top-0 z-20">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[#6c739c] hover:underline"
        >
          ‹ Dashboard
        </Link>
        <h1 className="font-bold text-slate-800 text-base">Payment History</h1>
        {data && (
          <span className="ml-auto text-sm text-slate-500">
            Total paid:{" "}
            <strong className="text-slate-800">{inr(data.totalPaid)}</strong>
          </span>
        )}
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !data || data.payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-700 font-semibold">No payments yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Payments you make across all your schools will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.tenantName + group.rows[0]?.tenantId}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">
                  {group.tenantName}
                </h2>
                <div className="flex flex-col gap-3">
                  {group.rows.map((p) => {
                    const b = badgeFor(p);
                    return (
                      <div
                        key={p.paymentId}
                        className="rounded-xl bg-white border border-slate-200 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">
                            {inr(p.amount)}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {p.studentName ?? "—"}
                            {p.term ? ` · ${p.term}` : ""}
                            {p.academicYear ? ` · ${p.academicYear}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {p.method ? `${p.method} · ` : ""}
                            {p.paidAt
                              ? new Date(p.paidAt).toLocaleString("en-IN")
                              : new Date(p.createdAt).toLocaleString("en-IN")}
                            {p.receiptNumber ? ` · #${p.receiptNumber}` : ""}
                          </p>
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: b.bg, color: b.text }}
                        >
                          {b.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

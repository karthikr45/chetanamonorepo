"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { fetchPayments, type Payment } from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

const STATUS: Record<string, { bg: string; text: string }> = {
  paid: { bg: "#dcfce7", text: "#15803d" },
  created: { bg: "#fef3c7", text: "#92400e" },
  failed: { bg: "#fee2e2", text: "#b91c1c" },
  refunded: { bg: "#e2e8f0", text: "#334155" },
};

export default function ParentPaymentsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchPayments()
      .then(setRows)
      .catch((err) =>
        setError(apiErrorMessage(err, "Could not load payments.")),
      )
      .finally(() => setLoading(false));
  }, [router]);

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
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-700 font-semibold">No payments yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Payments you make will appear here as receipts.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((p) => {
              const s = STATUS[p.status] ?? STATUS.created;
              return (
                <div
                  key={p.id}
                  className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">
                      {inr(p.amount)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.gateway ? `${p.gateway} · ` : ""}
                      {p.paymentType}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(
                        p.paidAt ?? p.createdAt,
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

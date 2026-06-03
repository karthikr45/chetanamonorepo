"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import {
  fetchOverview,
  fetchParentReceiptUrl,
  type OverviewChild,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

function inr(v: number | string) {
  const n = typeof v === "string" ? Number(v) : v;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

async function openReceipt(feePaymentId: string) {
  try {
    const url = await fetchParentReceiptUrl(feePaymentId);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    alert(apiErrorMessage(e, "Could not open the receipt"));
  }
}

const STATUS: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "#dcfce7", fg: "#15803d" },
  PARTIAL: { bg: "#fef3c7", fg: "#92400e" },
  UNPAID: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function FeeDetailsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [children, setChildren] = useState<OverviewChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    fetchOverview()
      .then((d) => setChildren(d.children))
      .catch((e) => setError(apiErrorMessage(e, "Could not load fee details.")))
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
        <h1 className="font-bold text-slate-800 text-base">Fee Details</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-slate-500">No children linked.</p>
        ) : (
          children.map((c) => (
            <section
              key={c.student.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    {c.student.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {c.student.class} · {c.student.section} · Roll{" "}
                    {c.student.rollNo} · Adm {c.student.admissionNumber}
                  </p>
                </div>
                {c.tc.issued ? (
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#e2e8f0", color: "#475569" }}
                    title={c.tc.reason ?? undefined}
                  >
                    TC issued
                    {c.tc.issuedAt
                      ? ` · ${new Date(c.tc.issuedAt).toLocaleDateString("en-IN")}`
                      : ""}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                )}
              </div>

              {c.categories.length === 0 && (
                <p className="px-5 py-4 text-sm text-slate-500">
                  No fee records yet.
                </p>
              )}

              {c.categories.map((cat) => (
                <div
                  key={cat.tenantId}
                  className="border-b border-slate-100 last:border-0"
                >
                  <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#f0dad5", color: "#6c739c" }}
                    >
                      {cat.type}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {cat.tenantName}
                    </span>
                  </div>

                  {cat.years.map((y) => (
                    <div key={y.academicYear} className="px-5 pb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-2 mb-1">
                        {y.academicYear}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                              <th className="py-1.5 pr-3">Term</th>
                              <th className="py-1.5 pr-3">Net</th>
                              <th className="py-1.5 pr-3">Paid</th>
                              <th className="py-1.5 pr-3">Balance</th>
                              <th className="py-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {y.terms.map((t) => {
                              const s =
                                STATUS[t.paymentStatus] ?? STATUS.UNPAID;
                              return (
                                <tr
                                  key={t.feeId}
                                  className="border-b border-slate-50"
                                >
                                  <td className="py-2 pr-3">{t.term}</td>
                                  <td className="py-2 pr-3">
                                    {inr(t.netAmount)}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {inr(t.paidAmount)}
                                  </td>
                                  <td className="py-2 pr-3 font-semibold">
                                    {inr(t.balance)}
                                  </td>
                                  <td className="py-2">
                                    <span
                                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                      style={{
                                        background: s.bg,
                                        color: s.fg,
                                      }}
                                    >
                                      {t.paymentStatus}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {y.payments.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                            Payments
                          </p>
                          <ul className="space-y-1.5">
                            {y.payments.map((p) => (
                              <li
                                key={p.feePaymentId}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px]"
                              >
                                <span className="min-w-0">
                                  <span className="font-semibold">
                                    {inr(p.amount)}
                                  </span>{" "}
                                  · {p.term ?? "—"} · {p.paymentType}
                                  {p.bounced ? (
                                    <span className="text-red-600 font-semibold">
                                      {" "}
                                      · BOUNCED
                                    </span>
                                  ) : p.clearanceStatus === "PENDING" ? (
                                    <span className="text-amber-600 font-semibold">
                                      {" "}
                                      · pending clearance
                                    </span>
                                  ) : null}
                                  <span className="text-slate-400">
                                    {" "}
                                    ·{" "}
                                    {new Date(p.paidAt).toLocaleDateString(
                                      "en-IN",
                                    )}
                                  </span>
                                </span>
                                <button
                                  onClick={() => openReceipt(p.feePaymentId)}
                                  className="flex-shrink-0 text-xs font-semibold text-[#6c739c] hover:underline"
                                >
                                  Receipt
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))
        )}
      </main>
    </div>
  );
}

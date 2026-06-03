"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import {
  listAllPaymentsApi,
  receiptUrl,
  type PaymentLogFilters,
  type PaymentLogRow,
} from "@/features/payments/api/payments.api";

export function PaymentLogsContent() {
  const [filters, setFilters] = useState<PaymentLogFilters>({});
  const [rows, setRows] = useState<PaymentLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(f: PaymentLogFilters = filters) {
    setLoading(true);
    setError(null);
    listAllPaymentsApi(f)
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setRows(list);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Could not load payments")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    load(filters);
  }

  function reset() {
    setFilters({});
    load({});
  }

  return (
    <div>
      <PageHeader
        title="Payment Logs"
        subtitle="Tenant-wide log of every recorded payment — online and offline. Click a row's print icon to open the receipt."
        meta={
          !loading && (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 tabular-nums">
              {rows.length}
            </span>
          )
        }
      />

      <Card padding="tight" className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <Field label="Type" className="sm:col-span-2">
            <select
              value={filters.type ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  type: (e.target.value || undefined) as PaymentLogFilters["type"],
                }))
              }
              className="filter-input"
            >
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </Field>
          <Field label="Clearance" className="sm:col-span-2">
            <select
              value={filters.clearance ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  clearance: (e.target.value || undefined) as PaymentLogFilters["clearance"],
                }))
              }
              className="filter-input"
            >
              <option value="">Any</option>
              <option value="NA">N/A (instant)</option>
              <option value="PENDING">Pending</option>
              <option value="CLEARED">Cleared</option>
              <option value="BOUNCED">Bounced</option>
            </select>
          </Field>
          <Field label="From" className="sm:col-span-2">
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
              className="filter-input"
            />
          </Field>
          <Field label="To" className="sm:col-span-2">
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
              className="filter-input"
            />
          </Field>
          <Field label="Search" className="sm:col-span-3">
            <input
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
              placeholder="receipt no / admission / name"
              className="filter-input"
            />
          </Field>
          <div className="sm:col-span-1 flex gap-1">
            <Button onClick={applyFilters} variant="primary" size="md" fullWidth>
              Apply
            </Button>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="text-xs font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] underline"
          >
            Reset filters
          </button>
        </div>
        <style jsx>{`
          :global(.filter-input) {
            height: 38px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            font-size: 13.5px;
            color: #0f172a;
            outline: none;
            width: 100%;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.filter-input:focus) {
            border-color: var(--app-brand);
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </Card>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">
            No payments match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <Th>Receipt</Th>
                  <Th>Date</Th>
                  <Th>Student</Th>
                  <Th>Term</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id} className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}>
                    <td className="px-5 py-3 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                      {p.receiptNumber ?? p.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3 text-[var(--app-text-secondary)] whitespace-nowrap">
                      {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      {p.student ? (
                        <div className="leading-tight">
                          <div className="font-semibold text-[var(--app-text-primary)]">{p.student.name}</div>
                          <div className="text-xs text-[var(--app-text-secondary)] tabular-nums">
                            {p.student.admissionNumber} · {p.student.class}-{p.student.section}
                          </div>
                        </div>
                      ) : <span className="text-[var(--app-text-muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3 text-[var(--app-text-secondary)] whitespace-nowrap">
                      {p.fee?.term ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[var(--app-text-primary)]">{p.paymentType}</td>
                    <td className="px-5 py-3">
                      <ClearancePill status={p.clearanceStatus} />
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[var(--app-text-primary)] tabular-nums whitespace-nowrap">
                      {inr(Number(p.amount))}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => printReceipt(p.id)}
                        className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
                      >
                        Print →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] whitespace-nowrap`}>
      {children}
    </th>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ClearancePill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "#dbeafe", fg: "#6c739c" },
    CLEARED: { bg: "#dcfce7", fg: "#15803d" },
    BOUNCED: { bg: "#fee2e2", fg: "#b91c1c" },
    NA: { bg: "#f1f5f9", fg: "#475569" },
  };
  const s = styles[status] ?? styles.NA;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {status === "NA" ? "—" : status}
    </span>
  );
}

async function printReceipt(paymentId: string) {
  try {
    const url = receiptUrl(paymentId);
    const token = getStoredToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    alert(getApiErrorMessage(err, "Could not open receipt"));
  }
}

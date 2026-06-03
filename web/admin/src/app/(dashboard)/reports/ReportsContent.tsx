"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  fetchReport,
  exportReport,
  type ReportFilters,
  type ReportResult,
  type ReportType,
} from "@/features/reports/api/reports.api";

const TABS: { key: ReportType; label: string; hint: string }[] = [
  {
    key: "fee-collection",
    label: "Fee Collection",
    hint: "Every collection in a date range (cleared + pending).",
  },
  {
    key: "outstanding-fees",
    label: "Outstanding Fees",
    hint: "Students with a balance still due.",
  },
  {
    key: "payment-summary",
    label: "Daily Collection",
    hint: "Day-by-day totals (defaults to the last 30 days).",
  },
];

const TERMS = [
  "1st Term Fee",
  "2nd Term Fee",
  "3rd Term Fee",
  "4th Term Fee",
  "5th Term Fee",
];

function inr(n: unknown) {
  const v = Number(n);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

function prettyKey(k: string) {
  return k
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function cell(key: string, value: unknown): string {
  if (value == null) return "—";
  if (
    /amount|balance|net|paid|collected|outstanding/i.test(key) &&
    !Number.isNaN(Number(value))
  ) {
    return inr(value);
  }
  if (key === "paidAt" && typeof value === "string") {
    return new Date(value).toLocaleString("en-IN");
  }
  return String(value);
}

export function ReportsContent() {
  const [tab, setTab] = useState<ReportType>("fee-collection");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (type: ReportType, f: ReportFilters) => {
      setLoading(true);
      setError(null);
      fetchReport(type, f)
        .then(setResult)
        .catch((err) =>
          setError(getApiErrorMessage(err, "Could not load the report.")),
        )
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    load(tab, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportReport(tab, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, "Export failed."));
    } finally {
      setExporting(false);
    }
  }

  const columns =
    result && result.rows.length > 0
      ? Object.keys(result.rows[0]).filter((k) => k !== "id")
      : [];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Fee collection, outstanding balances, and daily totals."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === t.key ? "#6c739c" : "#e2e8f0",
              color: tab === t.key ? "#fff" : "#0f172a",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <p className="text-xs text-slate-500 mb-3">
          {TABS.find((t) => t.key === tab)?.hint}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="From">
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, from: e.target.value }))
              }
              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, to: e.target.value }))
              }
              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
            />
          </Field>
          <Field label="Branch">
            <input
              value={filters.branch ?? ""}
              placeholder="All"
              onChange={(e) =>
                setFilters((p) => ({ ...p, branch: e.target.value }))
              }
              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
            />
          </Field>
          <Field label="Academic Year">
            <AcademicYearSelect
              value={filters.academicYear ?? ""}
              onChange={(v) =>
                setFilters((p) => ({ ...p, academicYear: v }))
              }
              includeAll
            />
          </Field>
          <Field label="Class">
            <input
              value={filters.class ?? ""}
              placeholder="All"
              onChange={(e) =>
                setFilters((p) => ({ ...p, class: e.target.value }))
              }
              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
            />
          </Field>
          <Field label="Term">
            <select
              value={filters.term ?? ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, term: e.target.value }))
              }
              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="">All</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => load(tab, filters)} disabled={loading}>
            {loading ? "Loading…" : "Run report"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting || !result || result.rows.length === 0}
          >
            {exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border px-3 py-2.5 text-sm"
          style={{
            backgroundColor: "#fef2f2",
            borderColor: "#fee2e2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(result.summary).map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl bg-white border border-slate-200 px-4 py-3 min-w-[140px]"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {prettyKey(k)}
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-800">
                {typeof v === "object"
                  ? Object.entries(v as Record<string, unknown>)
                      .map(([mk, mv]) => `${mk}: ${inr(mv)}`)
                      .join("  ·  ") || "—"
                  : /total|outstanding|collected|cleared|pending/i.test(k)
                    ? inr(v)
                    : String(v)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : !result || result.rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No data for the selected filters.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap"
                  >
                    {prettyKey(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr
                  key={(row.id as string) ?? i}
                  className="border-b border-slate-100"
                >
                  {columns.map((c) => (
                    <td
                      key={c}
                      className="px-4 py-2.5 text-slate-700 whitespace-nowrap"
                    >
                      {cell(c, (row as Record<string, unknown>)[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createAcademicYearApi,
  deleteAcademicYearApi,
  listAcademicYearsApi,
  updateAcademicYearApi,
  type AcademicYearRow,
} from "@/features/configuration/api/academic-years.api";

export function AcademicYearsContent() {
  const [rows, setRows] = useState<AcademicYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAcademicYearsApi()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setRows(list);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load academic years")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!/^\d{4}-\d{4}$/.test(year.trim())) {
      setError("Use YYYY-YYYY format (e.g. 2025-2026)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAcademicYearApi({ academicYear: year.trim(), isActive: true });
      setYear("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not add academic year"));
    } finally {
      setSubmitting(false);
    }
  }

  async function setCurrent(id: string) {
    try {
      await updateAcademicYearApi(id, { isCurrentYear: true });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not mark as current"));
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await updateAcademicYearApi(id, { isActive: !isActive });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update"));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this academic year? Students and fees attached to it will be orphaned.")) return;
    try {
      await deleteAcademicYearApi(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete"));
    }
  }

  return (
    <div>
      <PageHeader
        title="Academic Years"
        subtitle="Your tenant's list of academic years. Each tenant maintains its own copy — edits here don't affect the system defaults or other tenants."
        meta={
          !loading && (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 tabular-nums">
              {rows.length}
            </span>
          )
        }
        actions={
          <Button variant="primary" size="md" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add year
              </>
            )}
          </Button>
        }
      />

      {showForm && (
        <Card padding="default" className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                Academic year (YYYY-YYYY) *
              </span>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="2025-2026"
                className="h-10 px-3 rounded-lg border border-slate-200 outline-none text-sm focus:border-[var(--app-brand)] focus:shadow-[0_0_0_3px_rgb(11_84_171_/_0.15)]"
              />
            </label>
            <Button onClick={create} variant="primary" isLoading={submitting}>
              Save
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-[var(--app-brand-soft)] flex items-center justify-center text-[var(--app-brand)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">No academic years yet</h3>
            <p className="text-sm text-[var(--app-text-secondary)] mt-1">
              Click <strong>Add year</strong> to seed your first year (e.g. 2025-2026).
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Year</Th>
                <Th>Current</Th>
                <Th>Active</Th>
                <Th align="right"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <td className="px-5 py-3.5 font-semibold text-[var(--app-text-primary)] tabular-nums">{r.academicYear}</td>
                  <td className="px-5 py-3.5">
                    {r.isCurrentYear ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Current
                      </span>
                    ) : (
                      <button
                        onClick={() => setCurrent(r.id)}
                        className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
                      >
                        Set as current
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleActive(r.id, r.isActive)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => remove(r.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]`}>
      {children}
    </th>
  );
}

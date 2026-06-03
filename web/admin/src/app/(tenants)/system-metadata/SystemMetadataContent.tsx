"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createSystemMetadataApi,
  deleteSystemMetadataApi,
  listSystemMetadataApi,
  listSystemMetadataTypesApi,
  updateSystemMetadataApi,
  type SystemMetadataBody,
  type SystemMetadataRow,
} from "@/features/system-metadata/api/system-metadata.api";

const COMMON_TYPES = [
  "academic_year",
  "class",
  "section",
  "stream",
  "board_type",
  "medium",
  "tenant_type",
];

export function SystemMetadataContent() {
  const [types, setTypes] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<string>("academic_year");
  const [rows, setRows] = useState<SystemMetadataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SystemMetadataBody>({
    type: "academic_year",
    value: "",
    isActive: true,
  });

  const loadTypes = useCallback(() => {
    listSystemMetadataTypesApi()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        const merged = [...new Set([...COMMON_TYPES, ...list])];
        setTypes(merged);
      })
      .catch(() => setTypes(COMMON_TYPES));
  }, []);

  const load = useCallback((type: string) => {
    setLoading(true);
    setError(null);
    listSystemMetadataApi({ type })
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setRows(list);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Could not load metadata")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);
  useEffect(() => {
    load(activeType);
  }, [activeType, load]);

  async function create() {
    if (!form.value.trim()) return setError("Value is required");
    setSubmitting(true);
    setError(null);
    try {
      await createSystemMetadataApi({ ...form, type: activeType });
      setForm({ type: activeType, value: "", isActive: true });
      setShowForm(false);
      load(activeType);
      loadTypes();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(r: SystemMetadataRow) {
    try {
      await updateSystemMetadataApi(r.id, { isActive: !r.isActive });
      load(activeType);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update"));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this metadata row? Tenants currently using it will keep their copies, but it will be removed from dropdowns going forward.")) return;
    try {
      await deleteSystemMetadataApi(id);
      load(activeType);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete"));
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Metadata
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Curated reference data used by every tenant for dropdowns. Examples: academic years, classes, sections, board types. Tenant admins can read this list but cannot edit — they manage their own per-tenant overrides where applicable.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add metadata"}
        </Button>
      </header>

      {/* Type tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-[0.06em] transition-colors"
            style={{
              backgroundColor: activeType === t ? "#6c739c" : "#f1f5f9",
              color: activeType === t ? "#fff" : "#475569",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {showForm && (
        <Card padding="default" className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <Field label="Type" className="sm:col-span-3">
              <input
                value={activeType}
                onChange={(e) => setActiveType(e.target.value)}
                className="form-input"
                placeholder="academic_year"
              />
            </Field>
            <Field label="Value *" className="sm:col-span-3">
              <input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && create()}
                className="form-input"
                placeholder="2025-2026"
              />
            </Field>
            <Field label="Label (optional)" className="sm:col-span-3">
              <input
                value={form.label ?? ""}
                onChange={(e) => setForm({ ...form, label: e.target.value || undefined })}
                className="form-input"
                placeholder="2025–26 Academic Year"
              />
            </Field>
            <Field label="Order" className="sm:col-span-1">
              <input
                type="number"
                value={form.displayOrder ?? 0}
                onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                className="form-input"
              />
            </Field>
            <div className="sm:col-span-2">
              <Button onClick={create} variant="primary" isLoading={submitting} fullWidth>
                Save
              </Button>
            </div>
          </div>

          <style jsx>{`
            :global(.form-input) {
              height: 38px; padding: 0 12px; border-radius: 8px;
              border: 1px solid #e2e8f0; background: #fff; font-size: 14px;
              color: #0f172a; outline: none; width: 100%;
              transition: border-color .15s, box-shadow .15s;
            }
            :global(.form-input:focus) {
              border-color: #6c739c; box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
            }
          `}</style>
        </Card>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">
            No entries for type "<strong>{activeType}</strong>" yet. Click <strong>Add metadata</strong> to create one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Value</Th>
                <Th>Label</Th>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th align="right"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <td className="px-5 py-3.5 font-semibold text-slate-900 tabular-nums">{r.value}</td>
                  <td className="px-5 py-3.5 text-slate-500">{r.label ?? "—"}</td>
                  <td className="px-5 py-3.5 text-slate-500 tabular-nums">{r.displayOrder}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggle(r)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs font-semibold text-red-600 hover:underline">
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
    <th className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}>
      {children}
    </th>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

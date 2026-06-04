"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import { useAuth } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  applyPenaltyManualApi,
  createPenaltyRuleApi,
  deletePenaltyRuleApi,
  listPenaltyRulesApi,
  updatePenaltyRuleApi,
  waivePenaltyManualApi,
  type PenaltyAmountType,
  type PenaltyRuleBody,
  type PenaltyRuleRow,
  type PenaltyTerm,
} from "@/features/configuration/api/penalty-rules.api";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

const FALLBACK_TERMS: PenaltyTerm[] = [
  "1st Term Fee",
  "2nd Term Fee",
  "3rd Term Fee",
  "4th Term Fee",
  "5th Term Fee",
];

const FALLBACK_MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

type TabId = "rules" | "manual";

export function PenaltyRulesContent() {
  const [tab, setTab] = useState<TabId>("rules");

  return (
    <div>
      <PageHeader
        title="Penalty Rules"
        subtitle="Configure tenant-wide late-fee rules. Rules can target a specific term/year or apply to everything. You can also apply or waive penalties manually for one or many students."
      />

      <div
        className="mb-6 inline-flex items-center gap-1 rounded-xl border p-1 bg-white"
        style={{ borderColor: "var(--app-card-border)" }}
      >
        {[
          { id: "rules" as const, label: "Rules" },
          { id: "manual" as const, label: "Manual apply / waive" },
        ].map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: active ? "var(--app-brand-soft)" : "transparent",
                color: active ? "var(--app-brand)" : "var(--app-text-secondary)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "rules" ? <RulesPanel /> : <ManualPanel />}
    </div>
  );
}

// ─── Rules panel ───────────────────────────────────────────────────

function RulesPanel() {
  const { options: termOpts } = useMetadata("term", {
    fallback: FALLBACK_TERMS.map((v, i) => ({
      value: v,
      label: v,
      displayOrder: i,
      isActive: true,
    })),
  });
  const TERMS = termOpts.map((o) => o.value) as PenaltyTerm[];

  const [rows, setRows] = useState<PenaltyRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PenaltyRuleBody>({
    triggerAfterDays: 15,
    amountType: "FLAT",
    amount: 100,
    isActive: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listPenaltyRulesApi()
      .then((r) => setRows(Array.isArray(r) ? r : ((r as any)?.data ?? [])))
      .catch((err) => setError(getApiErrorMessage(err, "Could not load rules")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (form.amount <= 0) {
      setError("Amount must be > 0");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPenaltyRuleApi(form);
      setShowForm(false);
      setForm({ triggerAfterDays: 15, amountType: "FLAT", amount: 100, isActive: true });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create rule"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(r: PenaltyRuleRow) {
    try {
      await updatePenaltyRuleApi(r.id, { isActive: !r.isActive });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not toggle"));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await deletePenaltyRuleApi(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New rule"}
        </Button>
      </div>

      {showForm && (
        <Card padding="default">
          <h3 className="text-sm font-bold mb-4">New penalty rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Academic year (optional)" hint="Leave blank to apply to all years">
              <AcademicYearSelect
                value={form.academicYear ?? ""}
                onChange={(v) => setForm({ ...form, academicYear: v || undefined })}
                includeAll
                className="form-input"
              />
            </Field>
            <Field label="Term (optional)" hint="Leave blank to apply to every term">
              <select
                value={form.term ?? ""}
                onChange={(e) => setForm({ ...form, term: (e.target.value || undefined) as PenaltyTerm | undefined })}
                className="form-input"
              >
                <option value="">All terms</option>
                {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Trigger after (days late)" required>
              <input
                type="number"
                min={0}
                value={form.triggerAfterDays}
                onChange={(e) => setForm({ ...form, triggerAfterDays: Number(e.target.value) })}
                className="form-input"
              />
            </Field>
            <Field label="Type" required>
              <select
                value={form.amountType}
                onChange={(e) => setForm({ ...form, amountType: e.target.value as PenaltyAmountType })}
                className="form-input"
              >
                <option value="FLAT">Flat (one-time)</option>
                <option value="PER_DAY">Per day</option>
              </select>
            </Field>
            <Field label={form.amountType === "PER_DAY" ? "Amount per day (₹)" : "Flat amount (₹)"} required>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="form-input"
              />
            </Field>
            {form.amountType === "PER_DAY" && (
              <Field label="Max cap (₹) — optional">
                <input
                  type="number"
                  min={0}
                  value={form.maxAmount ?? ""}
                  onChange={(e) => setForm({ ...form, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
                  className="form-input"
                  placeholder="e.g. 1500"
                />
              </Field>
            )}
            <Field label="Description (optional)">
              <input
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value || undefined })}
                placeholder="e.g. Standard late-fee policy"
                className="form-input"
              />
            </Field>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} isLoading={submitting}>Save rule</Button>
          </div>

          <style jsx>{`
            :global(.form-input) {
              height: 40px; padding: 0 12px; border-radius: 8px;
              border: 1px solid #e2e8f0; background: #fff; font-size: 14px;
              color: #0f172a; outline: none; width: 100%;
              transition: border-color .15s, box-shadow .15s;
            }
            :global(.form-input:focus) {
              border-color: var(--app-brand);
              box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
            }
          `}</style>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[var(--app-text-secondary)]">
            No penalty rules configured yet. Click <strong>+ New rule</strong> to create one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Scope</Th>
                <Th>Trigger</Th>
                <Th>Penalty</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th align="right"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                    <div className="text-xs">{r.academicYear ?? "All years"} · {r.term ?? "All terms"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums">
                    {r.triggerAfterDays} days late
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-[var(--app-text-primary)] tabular-nums">
                    ₹{Number(r.amount).toLocaleString("en-IN")} {r.amountType === "PER_DAY" ? "/day" : "flat"}
                    {r.maxAmount && (
                      <span className="ml-1 text-xs font-normal text-[var(--app-text-secondary)]">
                        (max ₹{Number(r.maxAmount).toLocaleString("en-IN")})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">{r.description ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggle(r)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
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

// ─── Manual apply / waive panel ────────────────────────────────────

function ManualPanel() {
  const { user } = useAuth();
  // Transport / monthly-billing tenants apply penalties per month, not term.
  const isMonthly =
    (user?.billingMode ?? "").toLowerCase() === "monthly" ||
    ((user?.tenantType ?? "").toLowerCase() === "transport" && !user?.billingMode);
  const periodLabel = isMonthly ? "Month" : "Term";

  const { options: periodOpts } = useMetadata(isMonthly ? "month" : "term", {
    fallback: (isMonthly ? FALLBACK_MONTHS : FALLBACK_TERMS).map((v, i) => ({
      value: v,
      label: v,
      displayOrder: i,
      isActive: true,
    })),
  });
  const TERMS = periodOpts.map((o) => o.value);

  const [mode, setMode] = useState<"apply" | "waive">("apply");
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState<string>(TERMS[0] ?? "");

  useEffect(() => {
    if (TERMS.length && !TERMS.includes(term)) setTerm(TERMS[0]);
  }, [TERMS, term]);
  const [amount, setAmount] = useState("");
  const [applyToAll, setApplyToAll] = useState(true);
  const [admissionsText, setAdmissionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const admissions = admissionsText
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function submit() {
    setMessage(null);
    if (!academicYear.trim()) return setMessage({ kind: "err", text: "Academic year required" });
    if (mode === "apply" && (!amount || Number(amount) <= 0)) {
      return setMessage({ kind: "err", text: "Amount must be > 0" });
    }
    if (!applyToAll && admissions.length === 0) {
      return setMessage({ kind: "err", text: "Provide at least one admission number" });
    }
    setBusy(true);
    try {
      if (mode === "apply") {
        await applyPenaltyManualApi({
          academicYear: academicYear.trim(),
          term,
          amount: Number(amount),
          applyToAll,
          admissionNumbers: applyToAll ? [] : admissions,
        });
      } else {
        await waivePenaltyManualApi({
          academicYear: academicYear.trim(),
          term,
          applyToAll,
          admissionNumbers: applyToAll ? [] : admissions,
        });
      }
      setMessage({
        kind: "ok",
        text: mode === "apply"
          ? `Penalty applied to ${applyToAll ? "all eligible students" : `${admissions.length} student(s)`} for ${term}.`
          : `Penalty waived for ${applyToAll ? "all" : admissions.length} student(s) in ${term}.`,
      });
    } catch (err) {
      setMessage({ kind: "err", text: getApiErrorMessage(err, "Operation failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="default">
      <div className="flex items-center gap-2 mb-4">
        {(["apply", "waive"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: mode === m ? (m === "apply" ? "rgb(245 158 11 / 0.12)" : "rgb(16 185 129 / 0.12)") : "transparent",
              color: mode === m ? (m === "apply" ? "var(--app-warning)" : "var(--app-success)") : "var(--app-text-secondary)",
            }}
          >
            {m === "apply" ? "Apply penalty" : "Waive penalty"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Field label="Academic year" required>
          <AcademicYearSelect
            value={academicYear}
            onChange={setAcademicYear}
            className="form-input"
          />
        </Field>
        <Field label={periodLabel} required>
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="form-input">
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {mode === "apply" && (
          <Field label="Penalty amount (₹)" required>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="form-input"
            />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={applyToAll}
            onChange={() => setApplyToAll(true)}
            className="h-4 w-4 text-[var(--app-brand)] focus:ring-[var(--app-brand)]"
          />
          <span className="font-semibold">Apply to every non-PAID fee in this term</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={!applyToAll}
            onChange={() => setApplyToAll(false)}
            className="h-4 w-4 text-[var(--app-brand)] focus:ring-[var(--app-brand)]"
          />
          <span className="font-semibold">Only these admission numbers:</span>
        </label>
        {!applyToAll && (
          <textarea
            value={admissionsText}
            onChange={(e) => setAdmissionsText(e.target.value)}
            placeholder={"One admission number per line, or comma/space separated"}
            rows={3}
            className="form-input p-2 font-mono text-sm"
            style={{ minHeight: 80 }}
          />
        )}
      </div>

      {message && (
        <div
          className={`mb-3 p-3 rounded-lg text-sm ${message.kind === "ok" ? "bg-emerald-50 border border-emerald-100 text-emerald-800" : "bg-red-50 border border-red-100 text-red-700"}`}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button onClick={submit} variant="primary" isLoading={busy}>
          {mode === "apply" ? "Apply penalty" : "Waive penalty"}
        </Button>
      </div>

      <style jsx>{`
        :global(.form-input) {
          height: 40px; padding: 0 12px; border-radius: 8px;
          border: 1px solid #e2e8f0; background: #fff; font-size: 14px;
          color: #0f172a; outline: none; width: 100%;
          transition: border-color .15s, box-shadow .15s;
        }
        :global(.form-input:focus) {
          border-color: var(--app-brand);
          box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
        }
      `}</style>
    </Card>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]`}>
      {children}
    </th>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--app-text-muted)]">{hint}</span>}
    </label>
  );
}

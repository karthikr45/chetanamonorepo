"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  applyDiscountBulkApi,
  waiveDiscountBulkApi,
} from "@/features/configuration/api/penalty-rules.api";
import { useAuth } from "@/features/auth";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

const FALLBACK_TERMS = [
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

/**
 * Bulk discount apply / waive for one, many, or all students in a term —
 * mirrors the manual penalty panel. Hits POST /fees/discount/add and
 * /fees/discount/waive, which run through the tenant-admin approval gate
 * when the caller isn't a tenant/super admin.
 */
export function DiscountsContent() {
  const { user } = useAuth();
  // Transport / monthly-billing tenants bill per month, not per term.
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

  // Keep the selected period valid once term/month options resolve (e.g. the
  // tenant's billing mode hydrates after first render).
  useEffect(() => {
    if (TERMS.length && !TERMS.includes(term)) setTerm(TERMS[0]);
  }, [TERMS, term]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
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
        await applyDiscountBulkApi({
          academicYear: academicYear.trim(),
          term,
          amount: Number(amount),
          applyToAll,
          admissionNumbers: applyToAll ? [] : admissions,
          reason: reason.trim() || undefined,
        });
      } else {
        await waiveDiscountBulkApi({
          academicYear: academicYear.trim(),
          term,
          applyToAll,
          admissionNumbers: applyToAll ? [] : admissions,
          reason: reason.trim() || undefined,
        });
      }
      setMessage({
        kind: "ok",
        text:
          mode === "apply"
            ? `Discount applied to ${applyToAll ? "all eligible students" : `${admissions.length} student(s)`} for ${term}.`
            : `Discount waived for ${applyToAll ? "all" : admissions.length} student(s) in ${term}.`,
      });
    } catch (err) {
      setMessage({ kind: "err", text: getApiErrorMessage(err, "Operation failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle="Apply or waive a discount for one, many, or all students in a term. Requests from fin/ops admins are sent to a tenant admin for approval."
      />

      <Card padding="default">
        <div className="flex items-center gap-2 mb-4">
          {(["apply", "waive"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor:
                  mode === m
                    ? m === "apply"
                      ? "rgb(16 185 129 / 0.12)"
                      : "rgb(245 158 11 / 0.12)"
                    : "transparent",
                color:
                  mode === m
                    ? m === "apply"
                      ? "var(--app-success)"
                      : "var(--app-warning)"
                    : "var(--app-text-secondary)",
              }}
            >
              {m === "apply" ? "Apply discount" : "Waive discount"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Field label="Academic year" required>
            <AcademicYearSelect value={academicYear} onChange={setAcademicYear} className="form-input" />
          </Field>
          <Field label={periodLabel} required>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className="form-input">
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {mode === "apply" && (
            <Field label="Discount amount (₹)" required>
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

        <div className="mb-4">
          <Field label="Reason (optional)">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sibling concession"
              className="form-input"
            />
          </Field>
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
            {mode === "apply" ? "Apply discount" : "Waive discount"}
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input) {
            height: 40px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #fff;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            width: 100%;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input:focus) {
            border-color: var(--app-brand);
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </Card>
    </div>
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
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--app-text-muted)]">{hint}</span>}
    </label>
  );
}

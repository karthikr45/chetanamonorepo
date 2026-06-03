"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import {
  createStudentApi,
  type CreateStudentPayload,
} from "@/features/students/api/students.api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/features/auth";
import { getTenantById } from "@/features/tenants/services/tenants.service";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import {
  getOutstandingApi,
  searchIdentitiesApi,
  type IdentityMatch,
  type IdentityOutstanding,
} from "@/features/student-identities/api/student-identities.api";

function inr(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Fallback so the modal still works on a fresh DB before the seed runs.
const FALLBACK_TERMS = [
  "1st Term Fee",
  "2nd Term Fee",
  "3rd Term Fee",
  "4th Term Fee",
  "5th Term Fee",
];

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"] as const;

interface Props {
  open: boolean;
  defaultAcademicYear?: string;
  defaultBranch?: string;
  academicYearOptions?: string[];
  onClose: () => void;
  onCreated: () => void;
}

interface TermInput {
  enabled: boolean;
  amount: string;
  discount: string;
}

export function AddStudentModal({
  open,
  defaultAcademicYear = "",
  defaultBranch = "",
  academicYearOptions: academicYearOptionsProp,
  onClose,
  onCreated,
}: Props) {
  // AcademicYearSelect (used in the form below) owns its own data
  // source (system_metadata + current-year default), so the modal
  // doesn't need to fetch the AY list here. `defaultAcademicYear` /
  // `academicYearOptions` props are retained for callers that still
  // want to pre-seed the form state at mount.
  const computedDefaultAcademicYear = defaultAcademicYear;
  void academicYearOptionsProp;

  // The student's `schoolCode` is the current tenant's `tenantCode`. Fetch
  // the full tenant record by the signed-in user's tenantId and cache its
  // code so handleSubmit can send it on create.
  const { user } = useAuth();
  const [tenantCode, setTenantCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user?.tenantId) return;
    let cancelled = false;
    getTenantById(user.tenantId)
      .then((tenant) => {
        if (!cancelled) setTenantCode(tenant.tenantCode || null);
      })
      .catch(() => {
        /* non-fatal — submit will surface a clear error if the code is missing */
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.tenantId]);

  const { options: termOptions } = useMetadata("term", {
    fallback: FALLBACK_TERMS.map((v, i) => ({
      value: v,
      label: v,
      displayOrder: i,
      isActive: true,
    })),
  });
  const TERMS = useMemo(() => termOptions.map((o) => o.value), [termOptions]);
  const TERM_LABELS = useMemo(
    () => termOptions.map((_, i) => ORDINAL[i] ?? `${i + 1}th`),
    [termOptions],
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    branch: defaultBranch,
    academicYear: computedDefaultAcademicYear,
    admissionNumber: "",
    name: "",
    email: "",
    phoneNumber: "",
    class: "",
    section: "",
    rollNo: "",
  });

  // Defaults arrive asynchronously (academic-years fetch + JWT user
  // hydration). Keep the form's branch / AY in sync with the latest
  // values as long as the admin hasn't typed into those fields yet.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      branch: prev.branch || defaultBranch,
      academicYear: prev.academicYear || computedDefaultAcademicYear,
    }));
  }, [defaultBranch, computedDefaultAcademicYear]);

  // ─── Identity search (re-admission flow) ────────────────────────
  const [identitySearch, setIdentitySearch] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [identityResults, setIdentityResults] = useState<IdentityMatch[]>([]);
  const [searching, setSearching] = useState(false);
  // When linked, this is the identity_id sent on save. The card on top
  // displays the past enrollment so the admin sees it during data entry.
  const [linkedIdentity, setLinkedIdentity] = useState<IdentityMatch | null>(null);
  const [outstanding, setOutstanding] = useState<IdentityOutstanding | null>(null);

  async function runIdentitySearch() {
    if (
      !identitySearch.name.trim() &&
      !identitySearch.phone.trim() &&
      !identitySearch.email.trim()
    ) {
      setIdentityResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const results = await searchIdentitiesApi({
        name: identitySearch.name.trim() || undefined,
        phone: identitySearch.phone.trim() || undefined,
        email: identitySearch.email.trim() || undefined,
      });
      setIdentityResults(results);
    } catch (e) {
      setError(getApiErrorMessage(e, "Search failed"));
    } finally {
      setSearching(false);
    }
  }

  async function linkIdentity(m: IdentityMatch) {
    setLinkedIdentity(m);
    // Pre-fill name / email / phone from the identity to save typing.
    setForm((prev) => ({
      ...prev,
      name: m.identity.displayName,
      email: m.identity.primaryEmail ?? prev.email,
      phoneNumber: m.identity.primaryPhone ?? prev.phoneNumber,
    }));
    setIdentityResults([]);
    setOutstanding(null);
    try {
      const o = await getOutstandingApi(m.identity.id);
      setOutstanding(o);
    } catch {
      /* non-fatal — banner just won't show */
    }
  }

  function unlinkIdentity() {
    setLinkedIdentity(null);
    setOutstanding(null);
  }
  const [terms, setTerms] = useState<TermInput[]>(
    TERMS.map(() => ({ enabled: false, amount: "", discount: "" })),
  );

  if (!open) return null;

  function reset() {
    setForm({
      branch: defaultBranch,
      academicYear: computedDefaultAcademicYear,
      admissionNumber: "",
      name: "",
      email: "",
      phoneNumber: "",
      class: "",
      section: "",
      rollNo: "",
    });
    setTerms(TERMS.map(() => ({ enabled: false, amount: "", discount: "" })));
    setLinkedIdentity(null);
    setOutstanding(null);
    setIdentitySearch({ name: "", phone: "", email: "" });
    setIdentityResults([]);
    setError(null);
  }

  function setTerm(i: number, patch: Partial<TermInput>) {
    setTerms((curr) => curr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const required = ["academicYear", "admissionNumber", "name", "email", "phoneNumber", "class", "section", "rollNo"] as const;
    for (const k of required) {
      if (!form[k]?.toString().trim()) {
        setError(`${k} is required`);
        return;
      }
    }

    const payloadTerms: CreateStudentPayload["terms"] = [];
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      if (!t.enabled) continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(`${TERM_LABELS[i]} term fee must be a positive number`);
        return;
      }
      const discount = t.discount === "" ? 0 : Number(t.discount);
      if (!Number.isFinite(discount) || discount < 0) {
        setError(`${TERM_LABELS[i]} term discount must be 0 or more`);
        return;
      }
      if (discount > amount) {
        setError(`${TERM_LABELS[i]} term discount cannot exceed fee`);
        return;
      }
      payloadTerms.push({ term: TERMS[i], amount, discount });
    }

    if (!tenantCode) {
      setError("Could not resolve the tenant code. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      // Backend uses `schoolCode` (whitelist DTO rejects unknown fields),
      // which is the current tenant's `tenantCode`. Strip the form's
      // UI-level `branch` before sending.
      const { branch: _branch, ...rest } = form;
      void _branch;
      await createStudentApi({
        ...rest,
        schoolCode: tenantCode,
        identityId: linkedIdentity?.identity.id,
        terms: payloadTerms.length ? payloadTerms : undefined,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create student"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl my-auto" style={{ boxShadow: "0 32px 80px -16px rgba(15,23,42,0.25)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-text-primary)]">Add student</h2>
            <p className="text-xs text-[var(--app-text-secondary)] mt-0.5">
              Create one student and (optionally) up to 5 term fees in one go.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* ─── Re-admission search ─── */}
          {/* {linkedIdentity ? (
            <div className="mb-6 rounded-xl border border-[#dcb3ab] bg-[#f7ece9]/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#6c739c]">
                    Re-enrolling
                  </p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {linkedIdentity.identity.displayName}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {linkedIdentity.identity.primaryPhone ?? ""}
                    {linkedIdentity.identity.primaryPhone && linkedIdentity.identity.primaryEmail ? " · " : ""}
                    {linkedIdentity.identity.primaryEmail ?? ""}
                  </p>
                  {linkedIdentity.enrollments.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {linkedIdentity.enrollments.slice(0, 4).map((e) => (
                        <li
                          key={e.id}
                          className="text-[11px] text-slate-600 tabular-nums"
                        >
                          {e.academicYear} · Adm {e.admissionNumber} · Class {e.class}-{e.section}
                          {e.tcIssuedAt ? (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700">
                              TC issued
                            </span>
                          ) : (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={unlinkIdentity}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Unlink
                </button>
              </div>

              {outstanding && Number(outstanding.totalOutstanding) > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                  <p className="font-bold text-amber-800 mb-1">
                    ⚠ {inr(Number(outstanding.totalOutstanding))} pending from previous enrollment(s)
                  </p>
                  <ul className="space-y-0.5 text-amber-900 mb-2">
                    {outstanding.perEnrollment
                      .filter((e) => Number(e.totalOutstanding) > 0)
                      .map((e) => (
                        <li key={e.studentId} className="tabular-nums">
                          • Adm {e.admissionNumber} · {e.academicYear} —{" "}
                          {inr(Number(e.totalOutstanding))}
                          {" · "}
                          <a
                            href={`/payments?admission=${encodeURIComponent(e.admissionNumber)}&academicYear=${encodeURIComponent(e.academicYear)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-amber-800 hover:underline"
                          >
                            Open old payments →
                          </a>
                        </li>
                      ))}
                  </ul>
                  <p className="text-amber-700 text-[11px]">
                    These dues stay on the previous enrollment(s). Settle or
                    waive them there; nothing is carried forward to the new
                    admission automatically.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <details className="mb-6 rounded-xl border border-slate-200 bg-slate-50/40 p-4 group">
              <summary className="cursor-pointer text-sm font-bold text-slate-700 select-none flex items-center justify-between">
                <span>Returning student? Search by name / phone / email</span>
                <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={identitySearch.name}
                  onChange={(e) => setIdentitySearch({ ...identitySearch, name: e.target.value })}
                  placeholder="Name"
                  className="form-input"
                />
                <input
                  value={identitySearch.phone}
                  onChange={(e) => setIdentitySearch({ ...identitySearch, phone: e.target.value })}
                  placeholder="Parent phone"
                  className="form-input"
                />
                <input
                  value={identitySearch.email}
                  onChange={(e) => setIdentitySearch({ ...identitySearch, email: e.target.value })}
                  placeholder="Email"
                  className="form-input"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="secondary" type="button" isLoading={searching} onClick={runIdentitySearch}>
                  Search
                </Button>
              </div>
              {identityResults.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {identityResults.map((m) => (
                    <li
                      key={m.identity.id}
                      className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {m.identity.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {m.identity.primaryPhone ?? "—"}
                          {" · "}
                          {m.identity.primaryEmail ?? "—"}
                          {m.latestAdmissionNumber
                            ? ` · last Adm ${m.latestAdmissionNumber}`
                            : ""}
                          {" · "}
                          {m.enrollments.length} enrollment
                          {m.enrollments.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => linkIdentity(m)}
                        className="text-xs font-semibold text-[#6c739c] hover:underline"
                      >
                        Re-enrol →
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )} */}

          <SectionHeading>Identity</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Field label="Academic year" required>
              <AcademicYearSelect
                value={form.academicYear}
                onChange={(v) => setForm({ ...form, academicYear: v })}
                className="form-input"
              />
            </Field>
            <Field label="Admission number" required>
              <input
                value={form.admissionNumber}
                onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
                placeholder="Admission number"
                className="form-input"
                required
              />
            </Field>
            <Field label="Name" required>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Arjun Kumar" className="form-input" required />
            </Field>
            <Field label="Email" required>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="arjun@example.com" className="form-input" required />
            </Field>
            <Field label="Phone" required>
              <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+91 9876543210" className="form-input" required />
            </Field>
            <Field label="Class" required>
              <input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} placeholder="7" className="form-input" required />
            </Field>
            <Field label="Section" required>
              <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" className="form-input" required />
            </Field>
            <Field label="Roll No" required>
              <input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} placeholder="1" className="form-input" required />
            </Field>
          </div>

          <SectionHeading>
            Term fees{" "}
            <span className="text-xs font-normal text-[var(--app-text-secondary)]">(optional — toggle each term you want to set)</span>
          </SectionHeading>
          <div className="flex flex-col gap-2 mb-6">
            {TERM_LABELS.map((label, i) => (
              <div key={label} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <label className="flex items-center gap-2 sm:col-span-3 text-sm font-semibold text-[var(--app-text-primary)]">
                  <input type="checkbox" checked={terms[i].enabled} onChange={(e) => setTerm(i, { enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-[var(--app-brand)] focus:ring-[var(--app-brand)]" />
                  {label} Term Fee
                </label>
                <input type="number" min={0} value={terms[i].amount} onChange={(e) => setTerm(i, { amount: e.target.value })} placeholder="Amount" disabled={!terms[i].enabled} className="form-input form-input-tight sm:col-span-4 disabled:opacity-50" />
                <input type="number" min={0} value={terms[i].discount} onChange={(e) => setTerm(i, { discount: e.target.value })} placeholder="Discount (optional)" disabled={!terms[i].enabled} className="form-input form-input-tight sm:col-span-3 disabled:opacity-50" />
                <span className="sm:col-span-2 text-right text-xs font-bold text-[var(--app-text-muted)] tabular-nums">
                  {terms[i].enabled && terms[i].amount ? `Net ₹${Math.max(0, Number(terms[i].amount) - Number(terms[i].discount || 0)).toLocaleString("en-IN")}` : ""}
                </span>
              </div>
            ))}
          </div>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting} className="cursor-pointer">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={submitting} className="cursor-pointer">Save student</Button>
          </div>

          <style jsx>{`
            :global(.form-input) { height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; font-size: 14px; color: #0f172a; outline: none; width: 100%; transition: border-color 0.15s, box-shadow 0.15s; }
            :global(.form-input:focus) { border-color: var(--app-brand); box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15); }
            :global(.form-input::placeholder) { color: #94a3b8; }
            :global(.form-input-tight) { height: 36px; font-size: 13px; }
          `}</style>
        </form>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] mb-3">{children}</h3>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[var(--app-text-secondary)]">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

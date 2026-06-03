"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import {
  batchReceiptsUrl,
  findPaymentDetailsApi,
  listAllPaymentsApi,
  getReceiptStatusApi,
  listFeePaymentsApi,
  listFeeAdjustmentsApi,
  paymentSourceOf,
  recordOfflinePaymentApi,
  type FeeAdjustmentRow,
  type OfflinePaymentType,
  type ReceiptStatusResponse,
  type RecordOfflinePaymentBody,
  listPendingClearanceApi,
  receiptUrl,
  updateClearanceApi,
  type FeePaymentRow,
  type FeeRow,
  type FeeWithPayments,
  type PaymentDetailsGroup,
  type PaymentLogRow,
  type PendingClearancePayment,
  type StudentRow,
} from "@/features/payments/api/payments.api";
import {
  addDiscountManualApi,
  addPenaltyToFeeApi,
  waiveDiscountOnFeeApi,
  waivePenaltyOnFeeApi,
} from "@/features/configuration/api/penalty-rules.api";

/**
 * Visual metadata for the four adjustment kinds. Keeps the timeline
 * row terse — symbol, badge colour, sign for the amount column, and a
 * human label.
 */
const ADJUSTMENT_META: Record<
  "PENALTY_ADD" | "PENALTY_WAIVE" | "DISCOUNT_ADD" | "DISCOUNT_WAIVE",
  { label: string; symbol: string; badge: string; sign: string; amountTone: string }
> = {
  PENALTY_ADD: {
    label: "Penalty added",
    symbol: "▲",
    badge: "bg-amber-50 text-amber-700",
    sign: "+",
    amountTone: "text-amber-700",
  },
  PENALTY_WAIVE: {
    label: "Penalty waived",
    symbol: "▼",
    badge: "bg-slate-100 text-slate-600",
    sign: "−",
    amountTone: "text-slate-700",
  },
  DISCOUNT_ADD: {
    label: "Discount added",
    symbol: "▲",
    badge: "bg-emerald-50 text-emerald-700",
    sign: "+",
    amountTone: "text-emerald-700",
  },
  DISCOUNT_WAIVE: {
    label: "Discount waived",
    symbol: "▼",
    badge: "bg-slate-100 text-slate-600",
    sign: "−",
    amountTone: "text-slate-700",
  },
};

export function PaymentsPageContent() {
  return (
    <div>
      <PageHeader
        title="Payment Details"
        subtitle="Look up a student by admission number and see their complete fee history across School, Hostel and Transport tenants."
      />
      <ReceiptStatusBanner />
      <PaymentDetailsView />
    </div>
  );
}

/**
 * Small banner above Payment Details showing this tenant's receipt
 * prefix, the current period, and what the next issued number will be.
 * Tells admins at a glance "we're at receipt 0042 for 2025-26".
 */
function ReceiptStatusBanner() {
  const [status, setStatus] = useState<ReceiptStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReceiptStatusApi()
      .then((res) => {
        if (cancelled) return;
        const payload = ((res as any)?.data ?? res) as ReceiptStatusResponse;
        setStatus(payload ?? null);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const current = status.history.find((h) => h.periodKey === status.currentPeriod);
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Receipt prefix</span>
        <div className="font-mono font-bold text-slate-900">{status.prefix}</div>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Current period</span>
        <div className="font-semibold text-slate-900">{status.currentPeriod}</div>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Issued so far</span>
        <div className="tabular-nums font-semibold text-slate-900">
          {current?.currentValue ?? status.startNumber - 1}
        </div>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Next receipt</span>
        <div className="font-mono font-bold text-[var(--app-brand)]">{status.nextPreview}</div>
      </div>
      <div className="ml-auto text-[11px] text-slate-400">
        Reset policy:{" "}
        <span className="font-semibold text-slate-600">
          {status.resetPolicy.replace("_", " ").toLowerCase()}
        </span>{" "}
        · Configurable by super-admin per tenant.
      </div>
    </div>
  );
}

// ─── Print receipts panel ──────────────────────────────────────────

export function PrintReceiptsPanel() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // Accept comma, space, semicolon, or newline as separators.
  const ids = text
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function open() {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const url = batchReceiptsUrl(ids);
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
      alert(getApiErrorMessage(err, "Could not open receipts"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card padding="default">
        <h3 className="text-sm font-bold text-[var(--app-text-primary)] mb-1.5">
          Batch print receipts
        </h3>
        <p className="text-xs text-[var(--app-text-secondary)] mb-4 leading-relaxed">
          Paste one or many receipt numbers (or payment UUIDs). Separate with
          commas, spaces, semicolons, or newlines. We'll open all receipts in a
          single page with a "Print all" button — your browser handles the
          page breaks for the printer.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={
            "RCP-XXXX-20260510-0001\nRCP-XXXX-20260510-0002\n…or paste a comma-separated list"
          }
          className="form-input w-full p-3 font-mono text-sm leading-relaxed"
          style={{ minHeight: 140 }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--app-text-secondary)] tabular-nums">
            {ids.length} receipt{ids.length === 1 ? "" : "s"} parsed
          </span>
          <Button
            onClick={open}
            variant="primary"
            size="md"
            isLoading={busy}
            disabled={ids.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Open & Print
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input) {
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input:focus) {
            border-color: var(--app-brand);
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </Card>

      <RecentReceiptsCard onAdd={(rcpt) =>
        setText((prev) => (prev.trim() ? prev.trim() + "\n" + rcpt : rcpt))
      } />
    </div>
  );
}

function RecentReceiptsCard({ onAdd }: { onAdd: (rcpt: string) => void }) {
  const [recent, setRecent] = useState<PaymentLogRow[]>([]);
  useEffect(() => {
    listAllPaymentsApi({})
      .then((res) => {
        const list = unwrapList<PaymentLogRow>(res);
        setRecent(list.slice(0, 25));
      })
      .catch(() => {});
  }, []);
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-[var(--app-text-primary)]">Recent receipts</h3>
        <p className="text-xs text-[var(--app-text-secondary)] mt-0.5">
          Click a row to add its number to the batch above.
        </p>
      </div>
      {recent.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--app-text-secondary)] text-center">
          No payments recorded yet.
        </p>
      ) : (
        <ul>
          {recent.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer ${i !== recent.length - 1 ? "border-b border-slate-50" : ""}`}
              onClick={() => p.receiptNumber && onAdd(p.receiptNumber)}
            >
              <span className="text-xs font-bold text-[var(--app-text-secondary)] tabular-nums w-44 truncate">
                {p.receiptNumber ?? p.id.slice(0, 8)}
              </span>
              <span className="text-sm text-[var(--app-text-primary)] flex-1 truncate">
                {p.student?.name ?? "—"}
              </span>
              <span className="text-xs text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-xs font-bold text-[var(--app-text-primary)] tabular-nums whitespace-nowrap w-20 text-right">
                {inr(Number(p.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (!res || typeof res !== "object") return [];
  const obj = res as any;
  return obj.results ?? obj.items ?? obj.data?.results ?? obj.data?.items ?? obj.data ?? [];
}

// ─── Pending cheques panel ─────────────────────────────────────────

export function PendingClearancePanel() {
  const [items, setItems] = useState<PendingClearancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listPendingClearanceApi()
      .then((res) => {
        setItems(Array.isArray(res) ? res : (res as any)?.data ?? []);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load pending cheques")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleClearance(
    id: string,
    status: "CLEARED" | "BOUNCED",
    notes?: string,
  ) {
    setBusyId(id);
    try {
      await updateClearanceApi(id, status, notes);
      reload();
    } catch (err) {
      alert(getApiErrorMessage(err, "Could not update clearance"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {loading ? (
        <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">
          Loading…
        </p>
      ) : error ? (
        <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
            No pending cheques
          </h3>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)] max-w-sm mx-auto">
            Every cheque and DD submitted to your branch has been cleared or bounced.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100">
              <Th>Receipt</Th>
              <Th>Type</Th>
              <Th>Student</Th>
              <Th>Bank</Th>
              <Th>Drawer</Th>
              <Th align="right">Amount</Th>
              <Th>Submitted</Th>
              <Th align="right"></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr
                key={p.id}
                className={`hover:bg-slate-50 transition-colors ${i !== items.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                  {p.receiptNumber ?? p.id.slice(0, 8)}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold"
                    style={{ backgroundColor: "#dbeafe", color: "#6c739c" }}
                  >
                    {p.paymentType}
                    <span className="font-normal opacity-70">
                      #{p.paymentType === "DD" ? p.ddNumber : p.chequeNumber}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {p.student ? (
                    <div className="leading-tight">
                      <div className="font-semibold text-[var(--app-text-primary)]">
                        {p.student.name}
                      </div>
                      <div className="text-xs text-[var(--app-text-secondary)] tabular-nums">
                        {p.student.admissionNumber} · {p.student.class}-{p.student.section}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[var(--app-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                  {p.bankName}
                  {p.bankBranch && (
                    <div className="text-xs text-[var(--app-text-muted)]">
                      {p.bankBranch}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                  {p.drawerName ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-[var(--app-text-primary)] tabular-nums whitespace-nowrap">
                  {inr(Number(p.amount))}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                  {new Date(p.paidAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button
                    onClick={() =>
                      handleClearance(p.id, "CLEARED")
                    }
                    disabled={busyId === p.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold mr-1.5 transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#dcfce7", color: "#15803d" }}
                  >
                    Mark cleared
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt(
                        "Reason for bounce (e.g. insufficient funds)?",
                      );
                      if (reason !== null) handleClearance(p.id, "BOUNCED", reason);
                    }}
                    disabled={busyId === p.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}
                  >
                    Bounced
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ─── Record offline payment panel ──────────────────────────────────

function PaymentDetailsView() {
  // Fee picker
  const admissionRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    admissionRef.current?.focus();
  }, []);
  const search = useSearchParams();
  const [admission, setAdmission] = useState(
    () => search.get("admission") ?? "",
  );
  const [academicYear, setAcademicYear] = useState(
    () => search.get("academicYear") ?? "",
  );
  const autoRan = useRef(false);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [groups, setGroups] = useState<PaymentDetailsGroup[]>([]);
  // Flat list of fees across all groups (used for the selected-fee summary).
  const fees = useMemo(() => groups.flatMap((g) => g.fees), [groups]);
  const [feeId, setFeeId] = useState("");
  const [history, setHistory] = useState<FeePaymentRow[]>([]);
  const [adjustments, setAdjustments] = useState<FeeAdjustmentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState<
    | {
        kind: "discount" | "penalty" | "waive-discount" | "waive-penalty";
        fee: FeeRow;
      }
    | null
  >(null);
  const [recordPaymentFee, setRecordPaymentFee] = useState<FeeRow | null>(null);

  async function lookup() {
    setPickError(null);
    setStudent(null);
    setGroups([]);
    setFeeId("");
    setHistory([]);
    if (!admission.trim()) {
      setPickError("Enter an admission number");
      return;
    }
    setPicking(true);
    try {
      const res = await findPaymentDetailsApi(
        admission.trim(),
        academicYear.trim() || undefined,
      );
      const inner: { student: StudentRow | null; groups: PaymentDetailsGroup[] } =
        ((res as any)?.data ?? res) as {
          student: StudentRow | null;
          groups: PaymentDetailsGroup[];
        };
      if (!inner?.student) {
        setPickError(`No student found with admission "${admission}"`);
        return;
      }
      setStudent(inner.student);
      setGroups(inner.groups ?? []);
    } catch (err) {
      setPickError(getApiErrorMessage(err, "Lookup failed"));
    } finally {
      setPicking(false);
    }
  }

  // Arrived from a student / TC / identity link: go straight to that
  // pupil's history — never re-ask for the admission number.
  useEffect(() => {
    if (autoRan.current) return;
    if (search.get("admission")) {
      autoRan.current = true;
      void lookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory(id: string) {
    setHistoryLoading(true);
    setHistory([]);
    setAdjustments([]);
    try {
      const [paymentsRes, adjustmentsRes] = await Promise.all([
        listFeePaymentsApi(id),
        listFeeAdjustmentsApi(id),
      ]);
      const payments = Array.isArray(paymentsRes)
        ? paymentsRes
        : ((paymentsRes as any)?.data ?? []);
      const adjs = Array.isArray(adjustmentsRes)
        ? adjustmentsRes
        : ((adjustmentsRes as any)?.data ?? []);
      setHistory(payments);
      setAdjustments(adjs);
    } catch {
      setHistory([]);
      setAdjustments([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function pickFee(id: string) {
    setFeeId(id);
    if (id) loadHistory(id);
  }

  const step = !student ? 1 : 2;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-1 text-xs">
        {[
          { n: 1, label: "Find student" },
          { n: 2, label: "View fees & history" },
        ].map((s, i, arr) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors"
                style={{
                  backgroundColor: done
                    ? "var(--app-success)"
                    : active
                    ? "var(--app-brand)"
                    : "#e2e8f0",
                  color: done || active ? "#fff" : "#64748b",
                }}
              >
                {done ? "✓" : s.n}
              </span>
              <span
                className="font-semibold tracking-tight"
                style={{
                  color: done || active ? "var(--app-text-primary)" : "var(--app-text-muted)",
                }}
              >
                {s.label}
              </span>
              {i < arr.length - 1 && (
                <span className="mx-1 h-px w-6 bg-slate-200 hidden sm:inline-block" />
              )}
            </div>
          );
        })}
      </div>

      {/* Fee picker */}
      <Card padding="default">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)] mb-1.5 block">
              Admission number<span className="text-red-500"> *</span>
            </label>
            <input
              ref={admissionRef}
              value={admission}
              onChange={(e) => setAdmission(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup();
                }
              }}
              placeholder="Admission number"
              className="form-input"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)] mb-1.5 block">
              Academic year
            </label>
            <AcademicYearSelect
              value={academicYear}
              onChange={setAcademicYear}
              className="form-input"
            />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={lookup} variant="primary" isLoading={picking} fullWidth>
              Find student
            </Button>
          </div>
        </div>
        {pickError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
            {pickError}
          </div>
        )}

        {student && student.tcIssuedAt && (
          <div className="mt-5 p-3 rounded-xl border border-slate-300 bg-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-700 text-white">
              TC issued
            </span>
            <span className="text-sm text-slate-700">
              This enrollment was closed on{" "}
              <strong>
                {new Date(student.tcIssuedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </strong>
              {student.tcCertificateNo ? ` · TC ${student.tcCertificateNo}` : ""}
              {student.tcReason ? ` · ${student.tcReason}` : ""}
              . Outstanding fees can still be collected below.
            </span>
            {student.identityId && (
              <a
                href={`/students/identity/${student.identityId}`}
                className="ml-auto text-sm font-semibold text-[#6c739c] hover:underline"
              >
                Full history →
              </a>
            )}
          </div>
        )}

        {student && (
          <div className="mt-5 p-4 rounded-xl border bg-slate-50/60" style={{ borderColor: "var(--app-card-border)" }}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-3">
              {student.identityId && !student.tcIssuedAt && (
                <a
                  href={`/students/identity/${student.identityId}`}
                  className="order-last ml-auto text-xs font-semibold text-[#6c739c] hover:underline"
                >
                  Full history →
                </a>
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Student</div>
                <div className="text-sm font-bold text-[var(--app-text-primary)]">{student.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Adm / Class / Sec / Roll</div>
                <div className="text-sm font-semibold text-[var(--app-text-secondary)] tabular-nums">
                  {student.admissionNumber} · {student.class}-{student.section} · {student.rollNo}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Year</div>
                <div className="text-sm font-semibold text-[var(--app-text-secondary)] tabular-nums">{student.academicYear}</div>
              </div>
            </div>

            {groups.length === 0 || groups.every((g) => g.fees.length === 0) ? (
              <p className="text-sm text-[var(--app-text-secondary)]">
                No fees found for this student in any tenant.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((g) => (
                  <FeeGroupSection
                    key={g.tenantId}
                    group={g}
                    selectedFeeId={feeId}
                    onPick={pickFee}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Payment history (when a fee is picked) */}
      {feeId && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">Payment history</h3>
              <p className="text-xs text-[var(--app-text-secondary)]">Earlier payments recorded on this term</p>
            </div>
            {historyLoading && <span className="text-xs text-[var(--app-text-muted)]">Loading…</span>}
          </div>
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--app-text-secondary)] text-center">No payments recorded yet for this term.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <Th>Receipt</Th>
                  <Th>Date</Th>
                  <Th>Source</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">{""}</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const source = paymentSourceOf(h.paymentType);
                  return (
                    <tr key={h.id} className={`hover:bg-slate-50 ${i !== history.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <td className="px-5 py-3 text-[var(--app-text-secondary)] tabular-nums">{h.receiptNumber ?? h.id.slice(0, 8)}</td>
                      <td className="px-5 py-3 text-[var(--app-text-secondary)]">
                        {new Date(h.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            source === "Gateway"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {source}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-[var(--app-text-primary)]">{h.paymentType}</td>
                      <td className="px-5 py-3"><ClearancePill status={h.clearanceStatus} /></td>
                      <td className="px-5 py-3 text-right font-bold text-[var(--app-text-primary)] tabular-nums">{inr(Number(h.amount))}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => printReceipt(h.id)}
                          className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
                        >
                          Print →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Penalty / discount history (when a fee is picked) */}
      {feeId && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                Adjustment history
              </h3>
              <p className="text-xs text-[var(--app-text-secondary)]">
                Every penalty / discount add or waive on this term, with who and when.
              </p>
            </div>
            {historyLoading && (
              <span className="text-xs text-[var(--app-text-muted)]">Loading…</span>
            )}
          </div>
          {adjustments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--app-text-secondary)] text-center">
              No penalty or discount activity recorded for this term.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <Th>Date</Th>
                  <Th>Action</Th>
                  <Th align="right">Amount</Th>
                  <Th>Reason</Th>
                  <Th>By</Th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a, i) => {
                  const meta = ADJUSTMENT_META[a.kind as keyof typeof ADJUSTMENT_META];
                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-50 ${i !== adjustments.length - 1 ? "border-b border-slate-50" : ""}`}
                    >
                      <td className="px-5 py-3 text-[var(--app-text-secondary)] tabular-nums">
                        {new Date(a.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.badge}`}
                        >
                          <span>{meta.symbol}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold tabular-nums ${meta.amountTone}`}
                      >
                        {meta.sign}
                        {inr(Number(a.amount))}
                      </td>
                      <td className="px-5 py-3 text-[var(--app-text-secondary)]">
                        {a.reason || <span className="text-[var(--app-text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[var(--app-text-secondary)] text-xs">
                        {a.createdByEmail ?? "system"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Selected fee summary — mirrors the legacy student-edit modal */}
      {feeId && (() => {
        const f = fees.find((fee) => fee.id === feeId);
        if (!f) return null;
        const orig = Number(f.originalAmount);
        const disc = Number(f.totalDiscount);
        const pen = Number(f.totalPenalty ?? 0);
        const net = Number(f.netAmount);
        const paid = Number(f.paidAmount);
        const balance = Math.max(0, net - paid);
        return (
          <Card padding="tight" className="border-l-4" style={{ borderLeftColor: "var(--app-brand)" }}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                  Selected fee
                </div>
                <div className="text-base font-bold text-[var(--app-text-primary)]">
                  {f.term} · {student?.name}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--app-text-muted)] tabular-nums">
                  Net = Original {pen > 0 ? "+ Penalty " : ""}{disc > 0 ? "− Discount " : ""}= {inr(net)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setRecordPaymentFee(f)}
                    className="rounded-lg bg-[var(--app-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Record payment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAdjustModal({ kind: "discount", fee: f })}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  + Discount
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustModal({ kind: "penalty", fee: f })}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  + Penalty
                </button>
                {disc > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdjustModal({ kind: "waive-discount", fee: f })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Waive discount
                  </button>
                )}
                {pen > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdjustModal({ kind: "waive-penalty", fee: f })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Waive penalty
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
              <SumStat label="Original" value={inr(orig)} />
              <SumStat label="Discount" value={inr(disc)} tone={disc > 0 ? "green" : "slate"} />
              <SumStat label="Penalty" value={inr(pen)} tone={pen > 0 ? "amber" : "slate"} />
              <SumStat label="Net" value={inr(net)} bold />
              <SumStat label="Paid till now" value={inr(paid)} />
              <SumStat label="Balance" value={inr(balance)} bold tone={balance > 0 ? "amber" : "green"} />
            </div>
          </Card>
        );
      })()}

      {adjustModal && (
        <AdjustFeeModal
          kind={adjustModal.kind}
          fee={adjustModal.fee}
          onClose={() => setAdjustModal(null)}
          onApplied={() => {
            const id = adjustModal.fee.id;
            setAdjustModal(null);
            // Refresh the fee summary AND the adjustment timeline.
            if (admission.trim()) lookup();
            if (id) loadHistory(id);
          }}
        />
      )}

      {recordPaymentFee && (
        <RecordPaymentModal
          fee={recordPaymentFee}
          studentName={student?.name ?? ""}
          onClose={() => setRecordPaymentFee(null)}
          onRecorded={() => {
            const id = recordPaymentFee.id;
            setRecordPaymentFee(null);
            if (admission.trim()) lookup();
            if (id) loadHistory(id);
          }}
        />
      )}
    </div>
  );
}

function SumStat({
  label,
  value,
  bold,
  tone = "slate",
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "slate" | "green" | "amber";
}) {
  const palette = {
    slate: "#0f172a",
    green: "#15803d",
    amber: "#b45309",
  }[tone];
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-bold text-base" : "font-semibold text-sm"}`}
        style={{ color: palette }}
      >
        {value}
      </span>
    </div>
  );
}

function FeeGroupSection({
  group,
  selectedFeeId,
  onPick,
}: {
  group: PaymentDetailsGroup;
  selectedFeeId: string;
  onPick: (id: string) => void;
}) {
  const totals = group.fees.reduce(
    (acc, f) => {
      const net = Number(f.netAmount);
      const paid = Number(f.paidAmount);
      acc.net += net;
      acc.paid += paid;
      acc.balance += Math.max(0, net - paid);
      return acc;
    },
    { net: 0, paid: 0, balance: 0 },
  );
  const palette = {
    School: { bg: "rgb(11 84 171 / 0.10)", fg: "var(--app-brand)", label: "School" },
    Hostel: { bg: "rgb(139 92 246 / 0.12)", fg: "#7c3aed", label: "Hostel" },
    Transport: { bg: "rgb(245 158 11 / 0.12)", fg: "var(--app-warning)", label: "Transport" },
  }[group.type];

  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: "var(--app-card-border)" }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ backgroundColor: palette.bg, color: palette.fg }}
          >
            {palette.label}
          </span>
          <span className="text-sm font-bold text-[var(--app-text-primary)] truncate">
            {group.tenantName}
          </span>
        </div>
        <span className="text-xs text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
          {group.fees.length} fee · Bal{" "}
          <strong style={{ color: totals.balance > 0 ? "#b91c1c" : "#15803d" }}>
            {inr(totals.balance)}
          </strong>
        </span>
      </div>
      {group.fees.length === 0 ? (
        <p className="px-3 py-3 text-xs text-[var(--app-text-muted)]">
          No fees on file in this tenant.
        </p>
      ) : (
        <div className="flex flex-col">
          {group.fees.map((f, i) => {
            const balance = Math.max(0, Number(f.netAmount) - Number(f.paidAmount));
            const selected = selectedFeeId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onPick(f.id)}
                className={`text-left flex flex-wrap items-center gap-3 px-3 py-2.5 border-l-4 transition-all hover:bg-slate-50 cursor-pointer ${i !== group.fees.length - 1 ? "border-b border-slate-50" : ""}`}
                style={{
                  borderLeftColor: selected ? "var(--app-brand)" : "transparent",
                  backgroundColor: selected ? "var(--app-brand-soft)" : "transparent",
                }}
              >
                <span className="font-semibold text-[var(--app-text-primary)] flex-1 min-w-[110px]">
                  {f.term}
                </span>
                <StatusPill status={f.paymentStatus} />
                <span className="text-xs text-[var(--app-text-secondary)] tabular-nums">
                  Net <strong>{inr(Number(f.netAmount))}</strong> ·
                  Paid <strong>{inr(Number(f.paidAmount))}</strong> ·
                  Balance <strong style={{ color: balance > 0 ? "#b91c1c" : "#15803d" }}>{inr(balance)}</strong>
                </span>
                {f.payments && f.payments.length > 0 && (
                  <span className="text-[10px] text-[var(--app-text-muted)] font-bold">
                    {f.payments.length} pmt
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "UNPAID" | "PARTIAL" | "PAID" }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    PAID: { bg: "#dcfce7", fg: "#15803d", label: "Paid" },
    PARTIAL: { bg: "#fef3c7", fg: "#92400e", label: "Partial" },
    UNPAID: { bg: "#fee2e2", fg: "#b91c1c", label: "Unpaid" },
  };
  const s = styles[status] ?? styles.UNPAID;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
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

// ─── Helpers ───────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] whitespace-nowrap`}
    >
      {children}
    </th>
  );
}

/**
 * Modal used by Payment Details to apply a discount or a penalty to a
 * single selected fee. Calls the per-fee endpoint, surfaces validation
 * errors, and triggers a refresh in the caller.
 */
type AdjustKind = "discount" | "penalty" | "waive-discount" | "waive-penalty";

function AdjustFeeModal({
  kind,
  fee,
  onClose,
  onApplied,
}: {
  kind: AdjustKind;
  fee: FeeRow;
  onClose: () => void;
  onApplied: () => void;
}) {
  const isWaive = kind === "waive-discount" || kind === "waive-penalty";
  const isDiscount = kind === "discount" || kind === "waive-discount";
  const currentMax = isDiscount
    ? Number(fee.totalDiscount)
    : Number(fee.totalPenalty ?? 0);

  // For waive: default to "full" — user can switch to "partial".
  const [mode, setMode] = useState<"full" | "partial">(isWaive ? "full" : "partial");
  const [amount, setAmount] = useState(isWaive ? "" : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = (() => {
    if (kind === "discount") return "Add discount";
    if (kind === "penalty") return "Add penalty";
    if (kind === "waive-discount") return "Waive discount";
    return "Waive penalty";
  })();

  const submitLabel = (() => {
    if (kind === "discount") return "Add discount";
    if (kind === "penalty") return "Add penalty";
    if (kind === "waive-discount") return "Waive discount";
    return "Waive penalty";
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    let num: number | undefined;
    if (!isWaive || mode === "partial") {
      num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) {
        setErr("Enter a positive amount.");
        return;
      }
      if (isWaive && num > currentMax) {
        setErr(`Cannot waive more than the current ${isDiscount ? "discount" : "penalty"} (${inr(currentMax)}).`);
        return;
      }
    }
    setBusy(true);
    try {
      const payload = { amount: num, reason: reason.trim() || undefined };
      if (kind === "discount") {
        await addDiscountManualApi(fee.id, { amount: num as number, reason: payload.reason });
      } else if (kind === "penalty") {
        await addPenaltyToFeeApi(fee.id, { amount: num as number, reason: payload.reason });
      } else if (kind === "waive-discount") {
        await waiveDiscountOnFeeApi(fee.id, payload);
      } else {
        await waivePenaltyOnFeeApi(fee.id, payload);
      }
      onApplied();
    } catch (e2) {
      setErr(getApiErrorMessage(e2, `Could not ${title.toLowerCase()}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div>
              <span className="font-semibold">{fee.term}</span> · {fee.academicYear}
            </div>
            <div className="mt-1 tabular-nums text-[11px]">
              Original {inr(Number(fee.originalAmount))} · Penalty{" "}
              {inr(Number(fee.totalPenalty ?? 0))} · Discount{" "}
              {inr(Number(fee.totalDiscount))} · Net {inr(Number(fee.netAmount))}
            </div>
          </div>

          {isWaive && (
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("full")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  mode === "full"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Waive full {inr(currentMax)}
              </button>
              <button
                type="button"
                onClick={() => setMode("partial")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  mode === "partial"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Waive partial
              </button>
            </div>
          )}

          {(!isWaive || mode === "partial") && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount (₹) *
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={isWaive ? currentMax : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                autoFocus
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reason (optional)
            </span>
            <input
              type="text"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isDiscount
                  ? isWaive
                    ? "e.g. Discount no longer applicable"
                    : "e.g. Sibling concession, staff discount"
                  : isWaive
                    ? "e.g. Cheque cleared on time"
                    : "e.g. Late payment, cheque bounce charges"
              }
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            />
          </label>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={busy}>
              {submitLabel}
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            Recorded against this fee with your name + the time, visible in the
            adjustment history.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * Offline payment recorder used from the Payment Details fee summary.
 * Supports Cash / Cheque / DD / POS / NEFT — the conditional fields
 * mirror the legacy student-edit recorder.
 *
 * Cheque + DD payments are marked PENDING clearance server-side; the
 * paid_amount on the fee only moves once clearance is set to CLEARED.
 */
function RecordPaymentModal({
  fee,
  studentName,
  onClose,
  onRecorded,
}: {
  fee: FeeRow;
  studentName: string;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const balance = Math.max(0, Number(fee.netAmount) - Number(fee.paidAmount));
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<OfflinePaymentType>("CASH");
  const [amount, setAmount] = useState<string>(balance > 0 ? String(balance) : "");
  const [paidAt, setPaidAt] = useState<string>(today);
  const [notes, setNotes] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [ddNumber, setDdNumber] = useState("");
  const [ddDate, setDdDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setErr("Enter a positive amount.");
      return;
    }
    if (num > balance) {
      setErr(`Amount cannot exceed balance (${inr(balance)}).`);
      return;
    }
    if (!paidAt) {
      setErr("Payment date is required.");
      return;
    }
    if (mode === "CHEQUE") {
      if (!chequeNumber.trim() || !chequeDate) {
        setErr("Cheque number and cheque date are required.");
        return;
      }
    }
    if (mode === "DD") {
      if (!ddNumber.trim() || !ddDate) {
        setErr("DD number and DD date are required.");
        return;
      }
    }
    if ((mode === "POS" || mode === "NEFT") && !transactionId.trim()) {
      setErr(`${mode === "POS" ? "POS" : "NEFT"} transaction id is required.`);
      return;
    }

    setBusy(true);
    try {
      const body: RecordOfflinePaymentBody = {
        paymentType: mode,
        amount: num,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes.trim() || undefined,
      };
      if (mode === "CHEQUE") {
        body.chequeNumber = chequeNumber.trim();
        body.chequeDate = chequeDate;
        if (bankName.trim()) body.bankName = bankName.trim();
        if (bankBranch.trim()) body.bankBranch = bankBranch.trim();
        if (drawerName.trim()) body.drawerName = drawerName.trim();
      }
      if (mode === "DD") {
        body.ddNumber = ddNumber.trim();
        body.ddDate = ddDate;
        if (bankName.trim()) body.bankName = bankName.trim();
        if (bankBranch.trim()) body.bankBranch = bankBranch.trim();
        if (drawerName.trim()) body.drawerName = drawerName.trim();
      }
      if (mode === "POS") {
        body.transactionId = transactionId.trim();
        if (cardLast4.trim()) body.cardLast4 = cardLast4.trim();
      }
      if (mode === "NEFT") {
        body.transactionId = transactionId.trim();
        if (bankName.trim()) body.bankName = bankName.trim();
        if (bankBranch.trim()) body.bankBranch = bankBranch.trim();
      }
      await recordOfflinePaymentApi(fee.id, body);
      onRecorded();
    } catch (e2) {
      setErr(getApiErrorMessage(e2, "Could not record payment"));
    } finally {
      setBusy(false);
    }
  };

  const modes: { value: OfflinePaymentType; label: string }[] = [
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "DD", label: "DD" },
    { value: "POS", label: "POS / Card" },
    { value: "NEFT", label: "NEFT" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Record payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {fee.term} · {studentName} · Balance{" "}
              <span className="font-semibold tabular-nums">{inr(balance)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                Mode *
              </span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as OfflinePaymentType)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
              >
                {modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                Amount (₹) *
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                autoFocus
              />
              <span className="text-[10px] text-slate-400">
                Max {inr(balance)}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                Payment date *
              </span>
              <input
                type="date"
                max={today}
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
              />
            </label>
          </div>

          {(mode === "CHEQUE" || mode === "DD") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  {mode === "CHEQUE" ? "Cheque number *" : "DD number *"}
                </span>
                <input
                  value={mode === "CHEQUE" ? chequeNumber : ddNumber}
                  onChange={(e) =>
                    mode === "CHEQUE"
                      ? setChequeNumber(e.target.value)
                      : setDdNumber(e.target.value)
                  }
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  {mode === "CHEQUE" ? "Cheque date *" : "DD date *"}
                </span>
                <input
                  type="date"
                  value={mode === "CHEQUE" ? chequeDate : ddDate}
                  onChange={(e) =>
                    mode === "CHEQUE"
                      ? setChequeDate(e.target.value)
                      : setDdDate(e.target.value)
                  }
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Drawer name
                </span>
                <input
                  value={drawerName}
                  onChange={(e) => setDrawerName(e.target.value)}
                  placeholder="As written on the instrument"
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Bank
                </span>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Branch
                </span>
                <input
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <p className="sm:col-span-2 text-[11px] text-slate-500">
                Cheque / DD payments start as <strong>Pending clearance</strong>. The
                paid amount updates only after clearance is marked CLEARED under{" "}
                <em>Reports → Pending Cheques</em>.
              </p>
            </div>
          )}

          {mode === "POS" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Transaction id *
                </span>
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Card last 4
                </span>
                <input
                  maxLength={4}
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
            </div>
          )}

          {mode === "NEFT" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  UTR / Transaction id *
                </span>
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Bank
                </span>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Branch
                </span>
                <input
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Notes (optional)
            </span>
            <textarea
              rows={2}
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra context for the receipt or audit"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            />
          </label>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={busy}>
              Record payment
            </Button>
          </div>
        </form>
      </div>
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
        {required && <span className="text-red-500 normal-case"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-[var(--app-text-muted)]">{hint}</span>
      )}
    </label>
  );
}

/**
 * Open the printable HTML receipt in a new tab. The endpoint requires
 * Bearer auth so we fetch + open as a Blob URL like the Excel template
 * download.
 */
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  getIdentityApi,
  getOutstandingApi,
  issueTcApi,
  revokeTcApi,
  type EnrollmentOutstanding,
  type EnrollmentSummary,
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

/**
 * "Person view" — every enrollment row this identity has, newest
 * first. From here the admin can issue/revoke TC on a specific
 * enrollment, jump into Payment Details for that admission number,
 * or open the regular student profile.
 */
export function IdentityProfileContent({ identityId }: { identityId: string }) {
  const [match, setMatch] = useState<IdentityMatch | null>(null);
  const [outstanding, setOutstanding] = useState<IdentityOutstanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tcDialog, setTcDialog] = useState<EnrollmentSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, o] = await Promise.all([
        getIdentityApi(identityId),
        getOutstandingApi(identityId).catch(() => null),
      ]);
      setMatch(m);
      setOutstanding(o);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load identity"));
    } finally {
      setLoading(false);
    }
  }, [identityId]);

  const balanceByStudent = new Map<string, EnrollmentOutstanding>();
  for (const e of outstanding?.perEnrollment ?? []) {
    balanceByStudent.set(e.studentId, e);
  }

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(e: EnrollmentSummary) {
    if (!confirm(`Revoke TC for admission ${e.admissionNumber} (${e.academicYear})?`)) return;
    try {
      await revokeTcApi(e.id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke TC"));
    }
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error ?? "Not found."}
        </div>
        <Link href="/students" className="text-sm text-[#6c739c] hover:underline mt-3 inline-block">
          ← Students
        </Link>
      </div>
    );
  }

  const i = match.identity;
  const active = match.enrollments.filter((e) => !e.tcIssuedAt);
  const alumni = match.enrollments.filter((e) => e.tcIssuedAt);

  return (
    <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
      <Link href="/students" className="text-sm text-slate-500 hover:text-slate-700">
        ← Students
      </Link>

      <Card padding="default" className="mt-3 mb-5">
        <div className="flex items-center gap-4">
          {i.photoUrl ? (
            <img src={i.photoUrl} alt={i.displayName} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-[#6c739c]/10 text-[#6c739c] flex items-center justify-center text-2xl font-black">
              {i.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
              {i.displayName}
            </h1>
            <p className="text-sm text-slate-500 truncate">
              {i.primaryPhone ?? "—"}
              {" · "}
              {i.primaryEmail ?? "—"}
              {i.dateOfBirth ? ` · DOB ${i.dateOfBirth}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Identity id <code className="font-mono">{i.id.slice(0, 8)}…</code>
            </p>
          </div>
        </div>
      </Card>

      <Section title={`Active enrollments (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-3">
            No active enrollment. The student has not been re-admitted yet.
          </p>
        ) : (
          <EnrollmentTable
            rows={active}
            balances={balanceByStudent}
            onIssueTc={setTcDialog}
            onRevokeTc={revoke}
          />
        )}
      </Section>

      <Section title={`Alumni / past enrollments (${alumni.length})`}>
        {alumni.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-3">No past enrollments yet.</p>
        ) : (
          <EnrollmentTable
            rows={alumni}
            balances={balanceByStudent}
            onIssueTc={setTcDialog}
            onRevokeTc={revoke}
          />
        )}
      </Section>

      {tcDialog && (
        <TcDialog
          enrollment={tcDialog}
          outstanding={balanceByStudent.get(tcDialog.id) ?? null}
          onClose={() => setTcDialog(null)}
          onIssued={() => {
            setTcDialog(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className="mb-5 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <div>{children}</div>
    </Card>
  );
}

function EnrollmentTable({
  rows,
  balances,
  onIssueTc,
  onRevokeTc,
}: {
  rows: EnrollmentSummary[];
  balances: Map<string, EnrollmentOutstanding>;
  onIssueTc: (e: EnrollmentSummary) => void;
  onRevokeTc: (e: EnrollmentSummary) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50/60 border-b border-slate-100">
          <Th>Admission</Th>
          <Th>Year</Th>
          <Th>Class / Section / Roll</Th>
          <Th>Status</Th>
          <Th align="right">Balance</Th>
          <Th align="right">{""}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e, i) => {
          const bal = balances.get(e.id);
          const balanceNum = Number(bal?.totalOutstanding ?? 0);
          return (
            <tr
              key={e.id}
              className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}
            >
              <td className="px-5 py-3 font-mono font-semibold text-slate-900">
                {e.admissionNumber}
              </td>
              <td className="px-5 py-3 tabular-nums text-slate-600">{e.academicYear}</td>
              <td className="px-5 py-3 text-slate-600">
                {e.class}-{e.section} · Roll {e.rollNo} · {e.branch}
              </td>
              <td className="px-5 py-3">
                {e.tcIssuedAt ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700"
                    title={`Issued ${new Date(e.tcIssuedAt).toLocaleDateString("en-IN")}`}
                  >
                    TC issued
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700">
                    Active
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                {balanceNum > 0 ? (
                  <span className="font-bold text-amber-700">{inr(balanceNum)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-right space-x-3 text-xs">
                {balanceNum > 0 && (
                  <Link
                    href={`/payments?admission=${encodeURIComponent(e.admissionNumber)}&academicYear=${encodeURIComponent(e.academicYear)}`}
                    className="font-semibold text-amber-700 hover:underline"
                  >
                    Settle →
                  </Link>
                )}
                <Link
                  href={`/payments?admission=${encodeURIComponent(e.admissionNumber)}&academicYear=${encodeURIComponent(e.academicYear)}`}
                  className="font-semibold text-[#6c739c] hover:underline"
                >
                  Payments
                </Link>
                {e.tcIssuedAt ? (
                  <button
                    onClick={() => onRevokeTc(e)}
                    className="font-semibold text-amber-600 hover:underline"
                  >
                    Revoke TC
                  </button>
                ) : (
                  <button
                    onClick={() => onIssueTc(e)}
                    className="font-semibold text-red-600 hover:underline"
                  >
                    Issue TC
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TcDialog({
  enrollment,
  outstanding,
  onClose,
  onIssued,
}: {
  enrollment: EnrollmentSummary;
  outstanding: EnrollmentOutstanding | null;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [reason, setReason] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await issueTcApi(enrollment.id, {
        reason: reason.trim() || undefined,
        certificateNo: certificateNo.trim() || undefined,
        issuedAt: new Date(issuedAt).toISOString(),
      });
      onIssued();
    } catch (e2) {
      setErr(getApiErrorMessage(e2, "Could not issue TC"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Issue TC</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold">Admission</span> {enrollment.admissionNumber} ·{" "}
              {enrollment.academicYear}
            </p>
            <p className="mt-0.5">
              Class {enrollment.class}-{enrollment.section} · Roll {enrollment.rollNo}
            </p>
          </div>

          {outstanding && Number(outstanding.totalOutstanding) > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs">
              <p className="font-bold text-amber-800 mb-1">
                ⚠ {inr(Number(outstanding.totalOutstanding))} unpaid on this enrollment
              </p>
              <ul className="space-y-0.5 text-amber-900">
                {outstanding.unpaidFees.map((f) => (
                  <li key={f.feeId} className="tabular-nums">
                    • {f.term} — {inr(Number(f.remaining))}
                  </li>
                ))}
              </ul>
              <Link
                href={`/payments?admission=${encodeURIComponent(enrollment.admissionNumber)}&academicYear=${encodeURIComponent(enrollment.academicYear)}`}
                target="_blank"
                className="mt-2 inline-block font-semibold text-amber-800 hover:underline"
              >
                Settle / waive in Payment Details →
              </Link>
              <p className="mt-2 text-amber-700 text-[11px]">
                You can issue TC anyway. The unpaid fees stay on this enrollment
                and can be collected later from Payment Details.
              </p>
            </div>
          )}

          <Field label="Date of TC">
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="form-input-x"
            />
          </Field>
          <Field label="TC certificate no. (optional)">
            <input
              value={certificateNo}
              onChange={(e) => setCertificateNo(e.target.value)}
              placeholder="e.g. TC-2025-042"
              className="form-input-x"
              maxLength={50}
            />
          </Field>
          <Field label="Reason (optional)">
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Moving abroad / parent transfer / etc."
              className="form-input-x py-2"
              maxLength={500}
            />
          </Field>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Existing fees, payments and receipts on this enrollment are preserved.
            The row drops out of active rosters by default.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={busy}>
              Issue TC
            </Button>
          </div>
        </form>

        <style jsx>{`
          :global(.form-input-x) {
            height: 38px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #fff;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            width: 100%;
          }
          :global(.form-input-x:focus) {
            border-color: #6c739c;
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </div>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}

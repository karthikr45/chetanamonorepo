"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";
import {
  issueTcApi,
  listEnrollmentsByAdmissionApi,
  listStudentsForTcApi,
  revokeTcApi,
  tcCertificateUrl,
  type EnrollmentSummary,
  type TcRosterRow,
} from "@/features/student-identities/api/student-identities.api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

/** Fetch the TC HTML with auth, then open it as a blob in a new tab. */
async function openTcCertificate(studentId: string) {
  try {
    const token = getStoredToken();
    const res = await fetch(tcCertificateUrl(studentId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const objectUrl = URL.createObjectURL(
      new Blob([html], { type: "text/html" }),
    );
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    alert(getApiErrorMessage(err, "Could not open the TC certificate"));
  }
}

type StatusFilter = "tc_issued" | "active" | "all";

/**
 * Transfer Certificate register — year driven.
 *
 *  • Pick an academic year (+ optional class) and see, per the selected
 *    tab, the TC-issued list, the active roster (eligible to issue), or
 *    everyone.
 *  • Issue / revoke a TC inline.
 *  • "History" opens the person's full cross-year timeline (same
 *    admission across re-admissions) so a rejoin is obvious and maps to
 *    one record — issue/revoke per year from there too.
 */
export function TransferCertificateContent() {
  const { options: classOpts } = useMetadata("class");

  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [status, setStatus] = useState<StatusFilter>("tc_issued");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<TcRosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 50;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [tcFor, setTcFor] = useState<TcRosterRow | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listStudentsForTcApi({
        academicYear: year,
        class: klass || undefined,
        search: search.trim() || undefined,
        tcStatus: status,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load students"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [year, klass, status, search, page]);

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [year, klass, status, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function revoke(row: TcRosterRow) {
    if (
      !confirm(
        `Revoke TC for ${row.name} (${row.admissionNumber}, ${row.academicYear})?`,
      )
    )
      return;
    try {
      await revokeTcApi(row.id);
      setInfo(`TC revoked for ${row.name}.`);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke TC"));
    }
  }

  const tcCount = rows.filter((r) => r.tcIssuedAt).length;

  return (
    <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Transfer Certificate
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
          Pick an academic year to see the TC register, issue a TC for a
          leaving student, or revoke one. Use{" "}
          <span className="font-semibold">History</span> to see a student
          across every year — a re-admission (rejoin) maps to the same
          record automatically.
        </p>
      </header>

      <Card padding="default" className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Academic year
            </span>
            <AcademicYearSelect
              value={year}
              onChange={setYear}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20 min-w-[160px]"
            />
          </label>

          <label className="flex flex-col gap-1.5 min-w-[140px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Class
            </span>
            <select
              value={klass}
              onChange={(e) => setKlass(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            >
              <option value="">All classes</option>
              {classOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Search name / admission
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name or admission no."
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            />
          </label>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {(
            [
              ["tc_issued", "TC issued"],
              ["active", "Active (eligible)"],
              ["all", "All"],
            ] as [StatusFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatus(val)}
              className={`px-4 py-2 text-xs font-bold ${
                status === val
                  ? "bg-[#6c739c] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 p-3 rounded-lg bg-[#f7ece9] border border-[#e7c9c2] text-sm text-[#565c82]">
          {info}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {status === "tc_issued"
                ? "TCs issued"
                : status === "active"
                  ? "Active students (eligible for TC)"
                  : "All students"}{" "}
              · {year || "—"}
              {klass ? ` · Class ${klass}` : ""}
            </h3>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading…"
                : `${total} record(s)` +
                  (status === "all" && tcCount > 0
                    ? ` · ${tcCount} with TC on this page`
                    : "")}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100">
              <Th>Student</Th>
              <Th>Admission</Th>
              <Th>Class / Sec / Roll</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                  {year
                    ? "No students match these filters."
                    : "Pick an academic year to begin."}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <td className="px-5 py-3 font-semibold text-slate-900">
                  {r.name}
                </td>
                <td className="px-5 py-3 font-mono text-slate-600">
                  {r.admissionNumber}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {r.class}-{r.section} · Roll {r.rollNo} · {r.branch}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    {r.tcIssuedAt ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-700"
                        title={`Issued ${new Date(r.tcIssuedAt).toLocaleDateString("en-IN")}`}
                      >
                        TC · {new Date(r.tcIssuedAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    )}
                    {r.outstanding > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">
                        Dues {inr(r.outstanding)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                        No dues
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                  <button
                    onClick={() => setHistoryFor(r.admissionNumber)}
                    className="text-xs font-semibold text-slate-600 hover:underline"
                  >
                    History
                  </button>
                  <Link
                    href={`/payments?admission=${encodeURIComponent(r.admissionNumber)}&academicYear=${encodeURIComponent(r.academicYear)}`}
                    className="text-xs font-semibold text-[#6c739c] hover:underline"
                  >
                    Payments
                  </Link>
                  {r.tcIssuedAt ? (
                    <>
                      <button
                        onClick={() => openTcCertificate(r.id)}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Print TC
                      </button>
                      <button
                        onClick={() => revoke(r)}
                        className="text-xs font-semibold text-amber-600 hover:underline"
                      >
                        Revoke TC
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setTcFor(r)}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg"
                    >
                      Issue TC
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Page {page} of {totalPages} · {total} record(s)
            </span>
            <div className="space-x-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50"
              >
                ‹ Prev
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </Card>

      {tcFor && (
        <TcDialog
          enrollment={tcFor}
          onClose={() => setTcFor(null)}
          onIssued={() => {
            setTcFor(null);
            setInfo(`TC issued for ${tcFor.name}.`);
            load();
          }}
        />
      )}

      {historyFor && (
        <HistoryDialog
          admissionNumber={historyFor}
          onClose={() => setHistoryFor(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}

function TcDialog({
  enrollment,
  onClose,
  onIssued,
}: {
  enrollment: { id: string; name: string; admissionNumber: string; academicYear: string; class: string; section: string; rollNo: string; outstanding?: number };
  onClose: () => void;
  onIssued: () => void;
}) {
  const [reason, setReason] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dues = enrollment.outstanding ?? 0;
  const [ackDues, setAckDues] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (dues > 0 && !ackDues) {
      setErr("Please acknowledge the pending dues before issuing.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const duesNote =
        dues > 0 ? `[Issued with dues pending: ${inr(dues)}] ` : "";
      await issueTcApi(enrollment.id, {
        reason: (duesNote + reason.trim()).trim() || undefined,
        certificateNo: certificateNo.trim() || undefined,
        // Anchor at local noon so the calendar date can't slip a day
        // when stored as UTC / re-rendered in another timezone.
        issuedAt: new Date(`${issuedAt}T12:00:00`).toISOString(),
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
          <h2 className="text-lg font-bold text-slate-900">
            Issue Transfer Certificate
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold">{enrollment.name}</span> ·{" "}
              {enrollment.admissionNumber} · {enrollment.academicYear}
            </p>
            <p className="mt-0.5">
              Class {enrollment.class}-{enrollment.section} · Roll{" "}
              {enrollment.rollNo}
            </p>
          </div>

          {dues > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
              <p className="font-bold">
                Pending dues: {inr(dues)}
              </p>
              <p className="mt-1 text-[13px]">
                This student still owes fees. Most schools clear dues before
                issuing a TC. You can still proceed, but it will be recorded.
              </p>
              <label className="mt-2 flex items-start gap-2 text-[13px] font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackDues}
                  onChange={(e) => setAckDues(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Issue the TC despite {inr(dues)} pending (this note is
                  saved on the record).
                </span>
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Date of TC
            </span>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              TC certificate no. (optional)
            </span>
            <input
              value={certificateNo}
              onChange={(e) => setCertificateNo(e.target.value)}
              placeholder="e.g. TC-2025-042"
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
              maxLength={50}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Reason (optional)
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Moving abroad / parent transfer / etc."
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
              maxLength={500}
            />
          </label>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Existing fees, payments and receipts on this enrollment are kept.
            Unpaid dues can still be collected later from Payment Details.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={busy}
              disabled={dues > 0 && !ackDues}
            >
              Issue TC
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Cross-year timeline for one admission number — every enrollment the
 * person has had (re-admissions included), with TC status + inline
 * issue/revoke. This is the "is this a rejoin?" / mapping view.
 */
function HistoryDialog({
  admissionNumber,
  onClose,
  onChanged,
}: {
  admissionNumber: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<EnrollmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tcFor, setTcFor] = useState<EnrollmentSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listEnrollmentsByAdmissionApi(admissionNumber);
      setRows(res.enrollments ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load history"));
      setRows([]);
    }
  }, [admissionNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(row: EnrollmentSummary) {
    if (!confirm(`Revoke TC for ${row.academicYear}?`)) return;
    try {
      await revokeTcApi(row.id);
      load();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke TC"));
    }
  }

  const isRejoin = (rows?.length ?? 0) > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              History · {admissionNumber}
            </h2>
            {rows && (
              <p className="text-xs text-slate-500 mt-0.5">
                {isRejoin
                  ? `${rows.length} enrollments — re-admission/rejoin, all mapped to this admission.`
                  : "Single enrollment."}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}
          {!rows ? (
            <p className="text-sm text-slate-500 py-6 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No enrollment records.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <Th>Year</Th>
                  <Th>Class / Sec / Roll</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">
                      {r.academicYear}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.class}-{r.section} · Roll {r.rollNo} · {r.branch}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.tcIssuedAt ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-700">
                          TC ·{" "}
                          {new Date(r.tcIssuedAt).toLocaleDateString("en-IN")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.tcIssuedAt ? (
                        <button
                          onClick={() => revoke(r)}
                          className="text-xs font-semibold text-amber-600 hover:underline"
                        >
                          Revoke TC
                        </button>
                      ) : (
                        <button
                          onClick={() => setTcFor(r)}
                          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg"
                        >
                          Issue TC
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {tcFor && (
        <TcDialog
          enrollment={{
            id: tcFor.id,
            name: admissionNumber,
            admissionNumber: tcFor.admissionNumber,
            academicYear: tcFor.academicYear,
            class: tcFor.class,
            section: tcFor.section,
            rollNo: tcFor.rollNo,
          }}
          onClose={() => setTcFor(null)}
          onIssued={() => {
            setTcFor(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
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
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}

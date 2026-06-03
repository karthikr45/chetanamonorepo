"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listApprovalsApi,
  approveApi,
  rejectApi,
  type AdjustmentApproval,
  type ApprovalStatus,
} from "@/features/approvals/api/approvals.api";

const TABS: { key: ApprovalStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export function ApprovalsContent() {
  const { user } = useAuth();
  const canDecide =
    user?.role === "admin" || user?.role === "super_admin";

  const [tab, setTab] = useState<ApprovalStatus>("PENDING");
  const [rows, setRows] = useState<AdjustmentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback((status: ApprovalStatus) => {
    setLoading(true);
    setError(null);
    listApprovalsApi(status)
      .then(setRows)
      .catch((e) =>
        setError(getApiErrorMessage(e, "Could not load approvals")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function act(
    id: string,
    kind: "approve" | "reject",
  ) {
    const note =
      kind === "reject"
        ? window.prompt("Reason for rejecting (optional):") ?? undefined
        : window.prompt("Note (optional):") ?? undefined;
    setBusyId(id);
    setError(null);
    try {
      if (kind === "approve") await approveApi(id, note);
      else await rejectApi(id, note);
      load(tab);
    } catch (e) {
      setError(getApiErrorMessage(e, `Could not ${kind}`));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Discount & waive-off requests raised by fin/ops admins."
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

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No {tab.toLowerCase()} requests.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const open = openId === r.id;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {r.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.requestedByEmail ?? "—"} ·{" "}
                        <span className="uppercase tracking-wide">
                          {r.requestedByRole?.replace("_", " ")}
                        </span>{" "}
                        · {new Date(r.createdAt).toLocaleString("en-IN")}
                      </p>
                      {r.status !== "PENDING" && (
                        <p className="mt-1 text-xs">
                          <span
                            className="font-bold"
                            style={{
                              color:
                                r.status === "APPROVED"
                                  ? "#15803d"
                                  : "#b91c1c",
                            }}
                          >
                            {r.status}
                          </span>
                          {r.decisionNote ? ` — ${r.decisionNote}` : ""}
                          {r.result && !r.result.ok
                            ? ` · apply failed: ${r.result.error}`
                            : ""}
                        </p>
                      )}
                      <button
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="mt-1 text-xs font-semibold text-[#6c739c] hover:underline"
                      >
                        {open ? "Hide details" : "View details"}
                      </button>
                      {open && (
                        <pre className="mt-2 max-w-2xl overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
                          {JSON.stringify(r.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                    {r.status === "PENDING" && canDecide && (
                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "approve")}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: "#15803d" }}
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, "reject")}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

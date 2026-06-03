"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { get, getApiErrorMessage } from "@/lib/api-client";

interface PlatformSummary {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    byType: { type: string; count: number }[];
    recent: { id: string; name: string; type: string | null; createdAt: string }[];
  };
  admins: {
    total: number;
    byRole: { role: string; count: number }[];
  };
  students: { total: number };
  payments: {
    receivedThisMonth: string;
    receivedLastMonth: string;
    pendingClearance: string;
  };
  fees: { outstandingBalance: string };
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  fin_admin: "Finance Admin",
  ops_admin: "Operations Admin",
  parent: "Parent",
};

export function SuperAdminDashboardContent() {
  const [data, setData] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<unknown>("/dashboard/platform-summary")
      .then((res) => {
        if (cancelled) return;
        const payload =
          ((res as { data?: PlatformSummary })?.data ?? (res as PlatformSummary)) ??
          null;
        setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Could not load dashboard"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error ?? "No data available."}
        </div>
      </div>
    );
  }

  const receivedDelta =
    Number(data.payments.receivedThisMonth) -
    Number(data.payments.receivedLastMonth);

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          A bird's-eye view of every tenant on SVBK.
        </p>
      </header>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Tenants"
          value={data.tenants.total.toString()}
          hint={`${data.tenants.active} active · ${data.tenants.inactive} inactive`}
          tone="slate"
        />
        <StatTile
          label="Admin users"
          value={data.admins.total.toString()}
          hint={data.admins.byRole
            .map((r) => `${r.count} ${ROLE_LABEL[r.role] ?? r.role}`)
            .join(" · ")}
          tone="slate"
        />
        <StatTile
          label="Students"
          value={data.students.total.toLocaleString("en-IN")}
          hint="Across all tenants"
          tone="slate"
        />
        <StatTile
          label="Outstanding"
          value={inr(Number(data.fees.outstandingBalance))}
          hint="Unpaid balance, all tenants"
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Payments card */}
        <Card padding="default" className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Payments received</h3>
            <p className="text-xs text-slate-500">
              Excludes cheque/DD payments that are still pending clearance.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatTile
              label="This month"
              value={inr(Number(data.payments.receivedThisMonth))}
              hint={
                receivedDelta >= 0
                  ? `+${inr(Math.abs(receivedDelta))} vs last month`
                  : `−${inr(Math.abs(receivedDelta))} vs last month`
              }
              tone={receivedDelta >= 0 ? "green" : "amber"}
            />
            <StatTile
              label="Last month"
              value={inr(Number(data.payments.receivedLastMonth))}
              hint=""
              tone="slate"
            />
            <StatTile
              label="Pending clearance"
              value={inr(Number(data.payments.pendingClearance))}
              hint="Cheques / DDs not yet cleared"
              tone="amber"
            />
          </div>
        </Card>

        {/* Tenants by type */}
        <Card padding="default">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Tenants by type</h3>
          {data.tenants.byType.length === 0 ? (
            <p className="text-xs text-slate-500">No tenants yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.tenants.byType.map((b) => (
                <li
                  key={b.type}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">{b.type}</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {b.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent tenants */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recently added tenants</h3>
            <p className="text-xs text-slate-500">Latest 5 created.</p>
          </div>
          <Link
            href="/tenants"
            className="text-xs font-semibold text-[#6c739c] hover:underline"
          >
            View all →
          </Link>
        </div>
        {data.tenants.recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            No tenants yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Created</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.recent.map((t, i) => (
                <tr
                  key={t.id}
                  className={`hover:bg-slate-50 ${
                    i !== data.tenants.recent.length - 1
                      ? "border-b border-slate-50"
                      : ""
                  }`}
                >
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    {t.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.type ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600 tabular-nums">
                    {new Date(t.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/tenants/${t.id}`}
                      className="text-xs font-semibold text-[#6c739c] hover:underline"
                    >
                      Open →
                    </Link>
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

function StatTile({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "slate" | "green" | "amber";
}) {
  const valueColor = {
    slate: "#0f172a",
    green: "#15803d",
    amber: "#b45309",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <p
        className="mt-1 text-xl font-bold tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      )}
    </div>
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

"use client";

import React, { useEffect, useState } from "react";
import { getDashboardStatsApi } from "@/features/fees/api/fees.api";
import type { DashboardStatsData, DashboardStatItem } from "@/features/fees/types";
import { Card } from "@/components/ui/Card";

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconWarning() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function IconPayments() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function TrendChip({ stat }: { stat: DashboardStatItem }) {
  const positive = stat.trend !== "decrease";
  const abs = Math.abs(stat.percentageChange);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        {positive ? (
          <path d="M2 8l3-3 2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M2 4l3 3 2-2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {positive ? "+" : "-"}{abs}%
    </span>
  );
}

function StatCard({
  label,
  value,
  stat,
  iconBg,
  iconFg,
  Icon,
}: {
  label: string;
  value: string;
  stat: DashboardStatItem | null;
  iconBg: string;
  iconFg: string;
  Icon: () => React.ReactElement;
}) {
  return (
    <Card padding="default" interactive>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--app-text-primary)] tabular-nums">
            {value}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            {stat ? (
              <>
                <TrendChip stat={stat} />
                <span>vs last month</span>
              </>
            ) : (
              <span className="text-[var(--app-text-muted)]">No data yet</span>
            )}
          </div>
        </div>
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg, color: iconFg }}
        >
          <Icon />
        </div>
      </div>
    </Card>
  );
}

export function DashboardStats() {
  const [data, setData] = useState<DashboardStatsData | null>(null);

  useEffect(() => {
    getDashboardStatsApi()
      .then((res: any) => setData(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Total Students"
        value={data ? data.students.total.toLocaleString() : "—"}
        stat={data?.students ?? null}
        iconBg="rgb(11 84 171 / 0.10)"
        iconFg="var(--app-brand)"
        Icon={IconUsers}
      />
      <StatCard
        label="Active Penalties"
        value={data ? data.penalty.total.toLocaleString() : "—"}
        stat={data?.penalty ?? null}
        iconBg="rgb(245 158 11 / 0.12)"
        iconFg="var(--app-warning)"
        Icon={IconWarning}
      />
      <StatCard
        label="Fees Collected"
        value={data ? `₹${data.amount.total.toLocaleString()}` : "—"}
        stat={data?.amount ?? null}
        iconBg="rgb(16 185 129 / 0.12)"
        iconFg="var(--app-success)"
        Icon={IconPayments}
      />
    </div>
  );
}

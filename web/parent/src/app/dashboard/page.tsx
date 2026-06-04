"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isAuthenticated, getParent } from "@/lib/auth";
import {
  fetchDashboard,
  fetchFees,
  logout,
  type DashboardChild,
  type DashboardResponse,
  type Fee,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";
import { useTenantBranding } from "@/lib/branding";
import { FeeCard } from "@/components/FeeCard";

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#6c739c" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#5b21b6" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

export default function DashboardPage() {
  const router = useRouter();
  const { logoUrl: brandLogoUrl, isCustom: brandIsCustom } = useTenantBranding();
  const [mounted, setMounted] = useState(false);
  const [parent, setParentState] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const stored = getParent();
    if (stored) setParentState({ name: stored.name, email: stored.email });

    fetchDashboard()
      .then((data) => {
        setDashboard(data);
        if (data.children.length > 0) {
          setSelectedChildId(data.children[0].student.id);
        }
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load dashboard.")));
  }, [router]);

  useEffect(() => {
    if (!selectedChildId) {
      setFees([]);
      return;
    }
    setFeesLoading(true);
    fetchFees(selectedChildId)
      .then((data) => setFees(data))
      .catch((err) => setError(apiErrorMessage(err, "Could not load fees.")))
      .finally(() => setFeesLoading(false));
  }, [selectedChildId]);

  const refreshAfterPayment = useCallback(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch((err) =>
        setError(apiErrorMessage(err, "Could not refresh dashboard.")),
      );
    if (selectedChildId) {
      setFeesLoading(true);
      fetchFees(selectedChildId)
        .then(setFees)
        .catch((err) =>
          setError(apiErrorMessage(err, "Could not refresh fees.")),
        )
        .finally(() => setFeesLoading(false));
    }
  }, [selectedChildId]);

  const handleLogout = useCallback(async () => {
    await logout(); // logout itself does the hard nav to /login
  }, []);

  const selectedChild: DashboardChild | undefined = useMemo(
    () => dashboard?.children.find((c) => c.student.id === selectedChildId),
    [dashboard, selectedChildId],
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f1f5f9" }}>
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:sticky md:top-0 md:h-screen md:translate-x-0 md:z-auto md:flex-shrink-0`}
        style={{
          width: 264,
          backgroundColor: "#6c739c",
          backgroundImage:
            "radial-gradient(110% 60% at 0% 0%, rgba(255,255,255,0.10), transparent 55%)," +
            "radial-gradient(90% 60% at 100% 100%, rgba(217,166,159,0.18), transparent 60%)," +
            "linear-gradient(160deg,#6c739c 0%,#5b6188 55%,#565c82 100%)",
          borderRight: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="flex items-center gap-3 px-5 py-[18px]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 p-1 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.10), 0 8px 20px -8px rgba(108,115,156,0.6)",
            }}
          >
            <Image src={brandLogoUrl} alt="SVBK" width={34} height={34} className="w-full h-full object-contain" unoptimized={brandIsCustom} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-white text-[15px] leading-tight truncate">SVBK</p>
            <p className="text-[11px] text-white/65 truncate">Parent Portal</p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg,#6c739c,#d9a69f)",
                boxShadow: "0 8px 18px -8px rgba(108,115,156,0.8)",
              }}
            >
              {getInitials(parent?.name ?? "P")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white truncate">{parent?.name ?? "Parent"}</p>
              <p className="text-[11px] text-white/60 truncate">{parent?.email}</p>
            </div>
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: "#34d399", boxShadow: "0 0 8px 1px rgba(52,211,153,0.7)" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
          <p className="px-5 text-[10px] font-bold text-white/55 uppercase tracking-[0.14em] mb-2">
            My Children
          </p>
          <nav className="flex flex-col gap-1 px-3">
            {!dashboard && (
              <p className="px-3 py-2 text-xs text-white/55">Loading…</p>
            )}
            {dashboard?.children.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/55">No children linked yet.</p>
            )}
            {dashboard?.children.map((child, i) => {
              const isActive = selectedChildId === child.student.id;
              const avatar = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <button
                  key={child.student.id}
                  onClick={() => {
                    setSelectedChildId(child.student.id);
                    setSidebarOpen(false);
                  }}
                  className={`group relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive ? "" : "hover:bg-white/[0.055]"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundImage:
                            "linear-gradient(135deg, rgba(108,115,156,0.34), rgba(217,166,159,0.22))",
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -14px rgba(108,115,156,0.9)",
                        }
                      : undefined
                  }
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{
                        background: "linear-gradient(180deg,#d9a69f,#6c739c)",
                        boxShadow: "0 0 10px 1px rgba(217,166,159,0.65)",
                      }}
                    />
                  )}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                    style={{
                      background: `linear-gradient(135deg, ${avatar.bg}, ${avatar.text})`,
                    }}
                  >
                    {getInitials(child.student.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold leading-tight truncate ${
                        isActive ? "text-white" : "text-slate-200/90"
                      }`}
                    >
                      {child.student.name}
                    </p>
                    <p className="text-[11px] text-white/60 mt-0.5 truncate">
                      {child.student.class} · {child.student.section}
                    </p>
                  </div>
                  {child.amountDue > 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-200"
                      style={{
                        background: "rgba(245,158,11,0.18)",
                        boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.35)",
                      }}
                    >
                      Due
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div
          className="p-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300/80 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-300 text-sm font-medium"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="h-16 flex items-center px-4 sm:px-6 gap-4 bg-white border-b border-slate-200 sticky top-0 z-20"
          style={{ boxShadow: "0 1px 3px rgb(0 0 0 / 0.05)" }}
        >
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {selectedChild ? (
              <div>
                <h1 className="font-bold text-slate-800 text-base leading-tight truncate">
                  {selectedChild.student.name}
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  {selectedChild.student.class} · {selectedChild.student.section} · {selectedChild.student.rollNo} · Adm {selectedChild.student.admissionNumber}
                </p>
              </div>
            ) : (
              <h1 className="font-bold text-slate-800 text-base">Dashboard</h1>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <a
              href="/fee-details"
              className="text-sm font-semibold text-[#6c739c] hover:underline"
            >
              Fee Details
            </a>
            <a
              href="/payments"
              className="text-sm font-semibold text-[#6c739c] hover:underline"
            >
              Payments
            </a>
            <a
              href="/payment-history"
              className="text-sm font-semibold text-[#6c739c] hover:underline"
            >
              History
            </a>
            <a
              href="/feed"
              className="text-sm font-semibold text-[#6c739c] hover:underline"
            >
              School feed →
            </a>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          {dashboard && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total Paid" value={inr(dashboard.summary.totalPaid)} tone="green" />
                <StatCard label="Total Due" value={inr(dashboard.summary.totalDue)} tone="amber" />
                <StatCard label="Penalty" value={inr(dashboard.summary.totalPenalty)} tone="slate" />
                <StatCard
                  label="Pending Clearance"
                  value={inr(dashboard.summary.totalPendingClearance ?? 0)}
                  tone="blue"
                />
              </div>
              {dashboard.summary.totalPendingClearance > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-[#f7ece9] border border-[#e7c9c2] text-sm text-[#474b6b]">
                  You have <strong>{inr(dashboard.summary.totalPendingClearance)}</strong>{" "}
                  in cheque/DD payments awaiting bank clearance — they&apos;re with the
                  school but not yet recognised. Once cleared they&apos;ll move to
                  Total Paid.
                </div>
              )}
            </>
          )}

          {!selectedChild && dashboard?.children.length === 0 && (
            <EmptyState
              title="No children linked"
              body="Ask your school admin to link your account to your child's admission number."
            />
          )}

          {selectedChild && (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-extrabold text-slate-800">Fee Details</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Academic year {selectedChild.student.academicYear} · {selectedChild.feesCount} fee record(s)
                </p>
              </div>

              {feesLoading ? (
                <p className="text-sm text-slate-500">Loading fees…</p>
              ) : fees.length === 0 ? (
                <EmptyState
                  title="No fees yet"
                  body="No fee records were found for this child."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {fees.map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      onPaid={refreshAfterPayment}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "slate" | "blue";
}) {
  const palette = {
    green: { bg: "#dcfce7", text: "#15803d" },
    amber: { bg: "#fef3c7", text: "#92400e" },
    slate: { bg: "#f1f5f9", text: "#334155" },
    blue: { bg: "#dbeafe", text: "#6c739c" },
  }[tone];
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: palette.bg, borderColor: "transparent" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.text }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: palette.text }}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f7ece9] flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6c739c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <p className="text-slate-700 font-semibold">{title}</p>
      <p className="text-slate-400 text-sm mt-1 max-w-sm">{body}</p>
    </div>
  );
}

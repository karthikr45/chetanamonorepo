"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api-client";
import type { StudentFeeRow } from "@/features/students/types";
import { getStudentWithFees } from "@/features/payNow/services/payNow.service";
import { AcademicYearSelect } from "@/components/common/AcademicYearSelect";

/* ─── helpers ──────────────────────────────────────── */
function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/* ─── icon component ───────────────────────────────── */
function Icon({ d, cls = "h-4 w-4", sw = 2, style }: {
  d: string; cls?: string; sw?: number; style?: React.CSSProperties;
}) {
  return (
    <svg className={cls} style={style} fill="none" stroke="currentColor"
         strokeWidth={sw} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/* ─── icon paths ───────────────────────────────────── */
const I = {
  card:    "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  search:  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  user:    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  cal:     "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  book:    "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  grid:    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  hash:    "M7 20l4-16m2 16l4-16M6 9h14M4 15h14",
  phone:   "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  money:   "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  check:   "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  clock:   "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  tick:    "M5 13l4 4L19 7",
  chevron: "M19 9l-7 7-7-7",
  alert:   "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

/* ─── info tile ────────────────────────────────────── */
function Tile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl p-3"
         style={{ backgroundColor: "var(--app-search-bg)" }}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "color-mix(in srgb, var(--app-brand) 12%, transparent)" }}>
        <Icon d={icon} cls="h-3.5 w-3.5" style={{ color: "var(--app-brand)" }} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider"
           style={{ color: "var(--app-text-secondary)" }}>{label}</p>
        <p className="text-sm font-semibold leading-tight"
           style={{ color: "var(--app-text-primary)" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export function PayNowPageContent() {
  const router = useRouter();

  const [admissionNo,  setAdmissionNo]  = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [student,      setStudent]      = useState<StudentFeeRow | null>(null);
  const [searching,    setSearching]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!admissionNo.trim() || !academicYear) return;
    setSearching(true); setError(null); setStudent(null);
    try {
      const row = await getStudentWithFees(admissionNo.trim(), academicYear);
      setStudent(row);
    } catch (err) {
      setError(getApiErrorMessage(err, "Student not found. Please check the admission number."));
    } finally {
      setSearching(false);
    }
  }, [admissionNo, academicYear]);

  const termEntries  = student ? Object.entries(student.termFees) : [];
  const totalDue     = termEntries.filter(([, f]) => f.paymentStatus !== "Paid").reduce((s, [, f]) => s + f.amount, 0);
  const paidCount    = termEntries.filter(([, f]) => f.paymentStatus === "Paid").length;
  const pendingCount = termEntries.length - paidCount;

  const handlePayNow = (term: string) => {
    if (!student) return;
    const p = new URLSearchParams({ admissionNumber: student.admissionNumber, academicYear, term });
    router.push(`/pay-now/payment?${p.toString()}`);
  };

  const brand     = "var(--app-brand)";
  const brandGrad = `linear-gradient(135deg, ${brand}, color-mix(in srgb, ${brand} 68%, #565c82))`;

  const fieldBase: React.CSSProperties = {
    backgroundColor: "var(--app-search-bg)",
    borderColor:     "var(--app-divider)",
    color:           "var(--app-text-primary)",
  };

  const tiles = student ? [
    { label: "Class",   value: student.class,   icon: I.book  },
    { label: "Section", value: student.section,  icon: I.grid  },
    { label: "Roll No", value: student.rollNo,   icon: I.hash  },
    { label: "Phone",   value: student.phone,    icon: I.phone },
  ] : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>

      {/* ════════════════ HEADER ════════════════
          Mobile  : extra pb so the card can pull up slightly
          Desktop : compact — content flows naturally below
      ═══════════════════════════════════════════ */}
      <div className="relative overflow-hidden px-4 pt-6 pb-10 sm:px-6 sm:pb-12 md:pb-6 lg:px-8"
           style={{ background: brandGrad }}>
        {/* decorative blobs */}
        <span className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/[0.06]" />
        <span className="pointer-events-none absolute -left-6 bottom-0 h-32 w-32 rounded-full bg-white/[0.04]" />

        <div className="relative mx-auto max-w-5xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Icon d={I.card} cls="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white lg:text-2xl">Pay Now</h1>
            <p className="text-xs text-white/65 lg:text-sm">Search &amp; pay student fees instantly</p>
          </div>
        </div>
      </div>

      {/* ════════════════ BODY ════════════════ */}
      <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">

        {/* ── SEARCH CARD ──────────────────────
            Mobile/tablet : floats up over header  (-mt-6)
            Desktop (md+) : sits naturally below   (md:mt-6)
        ─────────────────────────────────────── */}
        <div className="-mt-6 rounded-2xl p-5 shadow-xl md:mt-6 md:shadow-md sm:p-6"
             style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-divider)" }}>

          {/* card header row */}
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "color-mix(in srgb, var(--app-brand) 12%, transparent)" }}>
              <Icon d={I.search} cls="h-4 w-4" style={{ color: brand }} />
            </span>
            <p className="font-semibold" style={{ color: "var(--app-text-primary)" }}>Find Student</p>
          </div>

          {/*
            Field layout:
              Mobile (<md) → stacked column
              Tablet / Desktop (md+) → single row  [Admission flex-1] [Year w-48] [Button auto]
          */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end">

            {/* Admission Number */}
            <div className="flex-1 space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider"
                     style={{ color: "var(--app-text-secondary)" }}>Admission Number</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Icon d={I.user} cls="h-4 w-4" style={{ color: "var(--app-text-secondary)" }} />
                </span>
                <input
                  className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:ring-2"
                  style={fieldBase}
                  placeholder="e.g. Dummy1"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            {/* Academic Year */}
            <div className="space-y-1.5 md:w-48 lg:w-56">
              <label className="block text-xs font-semibold uppercase tracking-wider"
                     style={{ color: "var(--app-text-secondary)" }}>Academic Year</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Icon d={I.cal} cls="h-4 w-4" style={{ color: "var(--app-text-secondary)" }} />
                </span>
                <AcademicYearSelect
                  value={academicYear}
                  onChange={setAcademicYear}
                  className="w-full appearance-none rounded-xl border py-2.5 pl-10 pr-8 text-sm outline-none transition-colors focus:ring-2"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Icon d={I.chevron} cls="h-4 w-4" style={{ color: "var(--app-text-secondary)" }} />
                </span>
              </div>
            </div>

            {/* Search button — full width on mobile, auto on md+ */}
            <button
              type="button"
              onClick={handleSearch}
              disabled={!admissionNo.trim() || !academicYear || searching}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 md:w-auto md:shrink-0"
              style={{ background: brandGrad, minHeight: "42px" }}
            >
              {searching ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching…
                </>
              ) : (
                <>
                  <Icon d={I.search} cls="h-4 w-4" />
                  Search Student
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <Icon d={I.alert} cls="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ════════════════ RESULTS ════════════════ */}
        {student && (
          <div className="mt-5 space-y-4">

            {/* ── STUDENT PROFILE CARD ──────────────
                Mobile : avatar on top, 2×2 tiles below
                md+    : avatar+name | divider | 4 tiles in a row
            ──────────────────────────────────────── */}
            <div className="overflow-hidden rounded-2xl shadow-sm"
                 style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-divider)" }}>
              {/* accent strip */}
              <div className="h-1.5"
                   style={{ background: "linear-gradient(90deg, var(--app-brand), color-mix(in srgb, var(--app-brand) 52%, #7c3aed))" }} />

              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">

                  {/* Avatar + name */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                         style={{ background: brandGrad }}>
                      {getInitials(student.name)}
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: "var(--app-text-primary)" }}>
                        {student.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--app-text-secondary)" }}>
                        Admission No: {student.admissionNumber}
                      </p>
                    </div>
                  </div>

                  {/* vertical divider — md+ only */}
                  <div className="hidden md:block md:w-px md:self-stretch"
                       style={{ backgroundColor: "var(--app-divider)" }} />

                  {/* Info tiles: 2×2 on mobile, 4×1 on md+ */}
                  <div className="grid flex-1 grid-cols-2 gap-2.5 md:grid-cols-4">
                    {tiles.map((t) => <Tile key={t.label} {...t} />)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── FEE SUMMARY CHIPS ── */}
            {termEntries.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  {
                    label: "Total Terms", val: termEntries.length,
                    bg: "var(--app-card-bg)", bd: "var(--app-divider)",
                    col: "var(--app-text-primary)",
                  },
                  {
                    label: "Pending", val: pendingCount,
                    bg: "color-mix(in srgb, var(--app-warning) 10%, transparent)",
                    bd: "color-mix(in srgb, var(--app-warning) 28%, transparent)",
                    col: "var(--app-warning)",
                  },
                  {
                    label: "Paid", val: paidCount,
                    bg: "color-mix(in srgb, var(--app-success) 10%, transparent)",
                    bd: "color-mix(in srgb, var(--app-success) 28%, transparent)",
                    col: "var(--app-success)",
                  },
                ].map(({ label, val, bg, bd, col }) => (
                  <div key={label} className="rounded-xl p-3 text-center sm:p-4"
                       style={{ backgroundColor: bg, border: `1px solid ${bd}` }}>
                    <p className="text-2xl font-bold sm:text-3xl" style={{ color: col }}>{val}</p>
                    <p className="mt-0.5 text-[11px] font-medium sm:text-xs" style={{ color: col }}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── TOTAL DUE BANNER ── */}
            {totalDue > 0 && (
              <div className="flex items-center justify-between rounded-xl px-4 py-4 sm:px-6"
                   style={{
                     background: `linear-gradient(135deg,
                       color-mix(in srgb, ${brand} 10%, transparent),
                       color-mix(in srgb, ${brand} 5%, transparent))`,
                     border: `1px solid color-mix(in srgb, ${brand} 22%, transparent)`,
                   }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `color-mix(in srgb, ${brand} 14%, transparent)` }}>
                    <Icon d={I.money} cls="h-4 w-4" style={{ color: brand }} />
                  </span>
                  <span className="font-semibold sm:text-base" style={{ color: brand }}>
                    Total Amount Due
                  </span>
                </div>
                <span className="text-xl font-bold sm:text-2xl" style={{ color: brand }}>
                  {formatCurrency(totalDue)}
                </span>
              </div>
            )}

            {/* ── FEE DETAIL CARDS ── */}
            <div className="space-y-3">
              <p className="px-0.5 text-xs font-semibold uppercase tracking-wider"
                 style={{ color: "var(--app-text-secondary)" }}>Fee Details</p>

              {termEntries.length === 0 ? (
                <div className="rounded-2xl py-10 text-center"
                     style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-divider)" }}>
                  <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>No term fees found.</p>
                </div>
              ) : (
                termEntries.map(([termName, fee]) => {
                  const isPaid     = fee.paymentStatus === "Paid";
                  const statusCol  = isPaid ? "var(--app-success)" : "var(--app-warning)";
                  const statusBg   = isPaid
                    ? "color-mix(in srgb, var(--app-success) 12%, transparent)"
                    : "color-mix(in srgb, var(--app-warning) 12%, transparent)";
                  const cardBorder = isPaid
                    ? "color-mix(in srgb, var(--app-success) 30%, transparent)"
                    : "var(--app-divider)";

                  return (
                    <div key={termName}
                         className="overflow-hidden rounded-2xl transition-shadow hover:shadow-md"
                         style={{ backgroundColor: "var(--app-card-bg)", border: `1px solid ${cardBorder}` }}>

                      {/* ── MOBILE: vertical layout (<sm) ── */}
                      <div className="sm:hidden">
                        <div className="flex items-start justify-between p-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                 style={{ backgroundColor: statusBg }}>
                              <Icon d={isPaid ? I.check : I.clock} cls="h-4 w-4"
                                    style={{ color: statusCol }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                                {termName}
                              </p>
                              <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                    style={{ backgroundColor: statusBg, color: statusCol }}>
                                {isPaid ? "✓ Paid" : "● Pending"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold" style={{ color: "var(--app-text-primary)" }}>
                              {formatCurrency(fee.amount)}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--app-text-secondary)" }}>Total</p>
                          </div>
                        </div>
                        {!isPaid && (
                          <div className="border-t px-4 pb-4 pt-3"
                               style={{ borderColor: "var(--app-divider)" }}>
                            <button type="button" onClick={() => handlePayNow(termName)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                                    style={{ background: brandGrad }}>
                              <Icon d={I.card} cls="h-4 w-4" />
                              Pay {formatCurrency(fee.amount)}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── TABLET + DESKTOP: horizontal row (sm+) ── */}
                      <div className="hidden sm:flex sm:items-center sm:gap-5 sm:px-6 sm:py-4">
                        {/* status icon */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                             style={{ backgroundColor: statusBg }}>
                          <Icon d={isPaid ? I.check : I.clock} cls="h-5 w-5"
                                style={{ color: statusCol }} />
                        </div>

                        {/* term name + badge */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold" style={{ color: "var(--app-text-primary)" }}>
                            {termName}
                          </p>
                          <span className="mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{ backgroundColor: statusBg, color: statusCol }}>
                            {isPaid ? "✓ Paid" : "● Pending"}
                          </span>
                        </div>

                        {/* amount */}
                        <div className="shrink-0 border-r px-6 text-right"
                             style={{ borderColor: "var(--app-divider)" }}>
                          <p className="text-lg font-bold" style={{ color: "var(--app-text-primary)" }}>
                            {formatCurrency(fee.amount)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--app-text-secondary)" }}>Total</p>
                        </div>

                        {/* action */}
                        <div className="shrink-0 pl-2">
                          {isPaid ? (
                            <div className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
                                 style={{ backgroundColor: statusBg, color: statusCol }}>
                              <Icon d={I.tick} cls="h-4 w-4" sw={2.5} />
                              Paid
                            </div>
                          ) : (
                            <button type="button" onClick={() => handlePayNow(termName)}
                                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                                    style={{ background: brandGrad }}>
                              <Icon d={I.card} cls="h-4 w-4" />
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── EMPTY STATE (before search) ── */}
        {!student && !searching && !error && (
          <div className="mt-10 flex flex-col items-center py-12 text-center sm:py-16">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
                 style={{ backgroundColor: `color-mix(in srgb, ${brand} 8%, transparent)` }}>
              <Icon d={I.search} cls="h-10 w-10" sw={1.5}
                    style={{ color: brand, opacity: 0.45 }} />
            </div>
            <p className="text-base font-bold sm:text-lg" style={{ color: "var(--app-text-primary)" }}>
              Search for a student
            </p>
            <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--app-text-secondary)" }}>
              Enter the admission number above to view fee details and make payments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

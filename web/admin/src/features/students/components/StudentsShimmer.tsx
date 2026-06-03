"use client";

import { Shimmer, ShimmerLine } from "@/components/common";

function ShimmerCard() {
  return (
    <div
      className="rounded-[var(--app-card-radius)] border p-4"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-sidebar-border)" }}
    >
      <ShimmerLine width="w-24" height="h-3" />
      <div className="mt-3">
        <ShimmerLine width="w-32" height="h-7" />
      </div>
    </div>
  );
}

function ShimmerActionBar() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-[var(--app-card-radius)] border p-4"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-sidebar-border)" }}
    >
      <ShimmerLine width="w-28" height="h-10" />
      <ShimmerLine width="w-28" height="h-10" />
      <div className="flex-1" />
      <ShimmerLine width="w-48" height="h-10" />
      <ShimmerLine width="w-20" height="h-10" />
      <ShimmerLine width="w-28" height="h-10" />
    </div>
  );
}

function ShimmerTableRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b" style={{ borderColor: "var(--app-divider)" }}>
      <td className="w-10 px-4 py-4">
        <Shimmer className="h-4 w-4 rounded" />
      </td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <ShimmerLine
            width={i === 0 ? "w-32" : i === cols - 1 ? "w-16" : "w-20"}
            height="h-4"
          />
        </td>
      ))}
    </tr>
  );
}

export function StudentsShimmer() {
  const headerCount = 8;

  return (
    <div className="space-y-2 animate-in fade-in">
      {/* Page header */}
      <div className="space-y-2 py-1">
        <ShimmerLine width="w-56" height="h-7" />
        <ShimmerLine width="w-80" height="h-4" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <ShimmerCard />
        <ShimmerCard />
        <ShimmerCard />
        <ShimmerCard />
      </div>

      {/* Action bar */}
      <ShimmerActionBar />

      {/* Table */}
      <div
        className="overflow-hidden rounded-[var(--app-card-radius)] border shadow-[var(--app-card-shadow)]"
        style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-sidebar-border)" }}
      >
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--app-divider)" }}>
          <ShimmerLine width="w-36" height="h-6" />
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-[var(--app-search-bg)]" style={{ borderColor: "var(--app-divider)" }}>
              <th className="w-10 px-4 py-4">
                <Shimmer className="h-4 w-4 rounded" />
              </th>
              {Array.from({ length: headerCount }).map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <ShimmerLine width="w-20" height="h-3" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerTableRow key={i} cols={headerCount} />
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: "var(--app-divider)" }}>
          <ShimmerLine width="w-40" height="h-4" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Shimmer key={i} className="h-9 w-9 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

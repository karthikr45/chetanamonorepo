"use client";

const transitionClass = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export interface DataTableCardProps {
  title: string;
  children: React.ReactNode;
  pagination?: React.ReactNode;
  className?: string;
}

export function DataTableCard({ title, children, pagination, className = "" }: DataTableCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--app-card-radius)] border shadow-[var(--app-card-shadow)] ${className}`}
      style={{
        backgroundColor: "var(--app-card-bg)",
        borderColor: "var(--app-sidebar-border)",
      }}
    >
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: "var(--app-divider)" }}
      >
        <h2 className="text-xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
      {pagination && (
        <footer
          className="flex flex-col gap-4 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--app-divider)" }}
        >
          {pagination}
        </footer>
      )}
    </div>
  );
}

export interface PaginationInfo {
  from: number;
  to: number;
  total: number;
  label?: string;
}

export interface PaginationProps {
  info: PaginationInfo;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Build the page numbers to render: [1, 2, 3, '…', last] style */
function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [];
  pages.push(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");

  pages.push(total);
  return pages;
}

function ChevronLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

const btnBase = `flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg text-sm font-medium ${transitionClass}`;

export function TablePagination({ info, currentPage, totalPages, onPageChange }: PaginationProps) {
  const label = info.label ?? "students";
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <>
      <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
        Showing {info.from}–{info.to} of {info.total} {label}
      </p>
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={`${btnBase} px-1.5 hover:bg-[var(--app-nav-hover-bg)] disabled:opacity-40`}
          style={{ color: "var(--app-text-secondary)" }}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </button>

        {/* Page numbers */}
        {pages.map((p, idx) =>
          p === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-9 min-w-[2.25rem] items-center justify-center text-sm"
              style={{ color: "var(--app-text-secondary)" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`${btnBase} px-2 ${
                p === currentPage
                  ? "text-white"
                  : "hover:bg-[var(--app-nav-hover-bg)]"
              }`}
              style={
                p === currentPage
                  ? { backgroundColor: "#334155", color: "#ffffff" }
                  : { color: "var(--app-text-primary)" }
              }
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={`${btnBase} px-1.5 hover:bg-[var(--app-nav-hover-bg)] disabled:opacity-40`}
          style={{ color: "var(--app-text-secondary)" }}
          aria-label="Next page"
        >
          <ChevronRight />
        </button>
      </div>
    </>
  );
}

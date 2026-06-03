"use client";

export interface SummaryCardItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const transitionClass = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export interface SummaryCardsProps {
  items: SummaryCardItem[];
  className?: string;
}

export function SummaryCards({ items, className = "" }: SummaryCardsProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`} style={{ padding: "var(--app-space-md) 0" }}>
      {items.map(({ label, value, icon }) => (
        <div
          key={label}
          className={`rounded-[var(--app-card-radius)] border p-4 shadow-[var(--app-card-shadow)] ${transitionClass} hover:shadow-[0 4px 16px -4px rgb(0 0 0 / 0.08)]`}
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-sidebar-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--app-text-secondary)" }}>{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--app-text-primary)" }}>{value}</p>
            </div>
            {icon && (
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: "var(--app-stat-icon-blue)" }}>
                {icon}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

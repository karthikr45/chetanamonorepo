import type { ReactNode } from "react";

export function ComingSoonCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--app-card-radius)] border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center shadow-sm">
      <div
        className="mx-auto mb-4 h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--app-brand-soft)", color: "var(--app-brand)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-[var(--app-text-primary)]">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-[var(--app-text-secondary)] max-w-md mx-auto leading-relaxed">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

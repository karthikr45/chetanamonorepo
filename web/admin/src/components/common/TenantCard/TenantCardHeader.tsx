import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TenantCardHeaderProps } from "./types";

function stopCardActivation(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

function HeaderIconAction({
  label,
  onActivate,
  children,
  className,
}: {
  label: string;
  onActivate: () => void;
  children: ReactNode;
  className?: string;
}) {
  const onClick = (e: MouseEvent) => {
    stopCardActivation(e);
    onActivate();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    stopCardActivation(e);
    onActivate();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--app-text-secondary)] transition-colors",
        "hover:bg-slate-100 hover:text-[var(--app-text-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/40",
        className,
      )}
    >
      {children}
    </span>
  );
}

function avatarFromName(name: string): { initials: string; color: string } {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const palette = [
    "linear-gradient(135deg,#6c739c,#565c82)",
    "linear-gradient(135deg,#7c3aed,#4f46e5)",
    "linear-gradient(135deg,#0f766e,#0e7490)",
    "linear-gradient(135deg,#b45309,#7c2d12)",
    "linear-gradient(135deg,#be185d,#7e22ce)",
  ];
  const i = (name?.charCodeAt(0) ?? 0) % palette.length;
  return { initials, color: palette[i] };
}

/**
 * TenantCardHeader - Premium header with avatar logo + title + actions row.
 */
export function TenantCardHeader({
  title,
  subtitle,
  showCheckmark = false,
  onEdit,
  onDelete,
  className,
}: TenantCardHeaderProps) {
  const { initials, color } = avatarFromName(title);

  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm"
          style={{ background: color }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-[var(--app-text-primary)]">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-[var(--app-text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        {onEdit && (
          <HeaderIconAction label="Edit" onActivate={onEdit}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </HeaderIconAction>
        )}
        {onDelete && (
          <HeaderIconAction label="Delete" onActivate={onDelete} className="hover:text-red-600 focus-visible:ring-red-500/40">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </HeaderIconAction>
        )}
        {showCheckmark && (
          <span
            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
            style={{ backgroundColor: "var(--app-brand)" }}
            aria-hidden
          >
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

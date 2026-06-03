"use client";

import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Breadcrumb items, e.g. [{ label: "Home", href: "/dashboard" }, { label: "Parents" }] */
  breadcrumbs?: { label: string; href?: string }[];
  /** Right-side actions (primary button, filters, etc.). */
  actions?: ReactNode;
  /** Inline meta shown to the right of the title (badge, count, status). */
  meta?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs">
            {breadcrumbs.map((bc, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <li key={i} className="flex items-center gap-1.5">
                  {bc.href && !isLast ? (
                    <a
                      href={bc.href}
                      className="font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
                    >
                      {bc.label}
                    </a>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "font-semibold text-[var(--app-text-primary)]"
                          : "text-[var(--app-text-secondary)]"
                      }
                    >
                      {bc.label}
                    </span>
                  )}
                  {!isLast && (
                    <svg
                      className="h-3 w-3 text-[var(--app-text-muted)]"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
              {title}
            </h1>
            {meta}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-sm text-[var(--app-text-secondary)] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

const transitionClass = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export interface ActionBarProps {
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  actionOptions?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFiltersClick?: () => void;
  filterOptions?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
  actionOptions,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  onFiltersClick,
  filterOptions,
  className = "",
}: ActionBarProps) {
  return (
    <div className={"flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between lg:flex-nowrap " + className} style={{ padding: "var(--app-space-md) 0" }}>
      <div className="flex w-full flex-wrap items-stretch gap-2 md:w-auto md:items-center">
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className={"inline-flex h-11 items-center justify-center rounded-xl px-4 font-medium " + transitionClass + " hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-search-focus)] focus-visible:ring-offset-2"}
            style={{ backgroundColor: "var(--app-brand, #6c739c)", color: "var(--app-nav-active-bg)", cursor: "pointer" }}
          >
            {primaryLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className={"inline-flex h-11 items-center justify-center rounded-xl border px-4 font-medium " + transitionClass + " hover:bg-[var(--app-nav-hover-bg)]"}
            style={{ borderColor: "var(--auth-input-focus)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)",cursor: "pointer" }}
          >
            {secondaryLabel}
          </button>
        )}
        {tertiaryLabel && onTertiary && (
          <button
            type="button"
            onClick={onTertiary}
            className={"inline-flex h-11 items-center justify-center rounded-xl px-4 font-medium " + transitionClass + " hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-search-focus)] focus-visible:ring-offset-2"}
            style={{ backgroundColor: "var(--app-brand, #6c739c)", color: "var(--app-nav-active-bg)", cursor: "pointer" }}
          >
            {tertiaryLabel}
          </button>
        )}
        {actionOptions}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-full md:justify-end lg:w-auto lg:flex-nowrap">
        {onFiltersClick && (
          <button
            type="button"
            onClick={onFiltersClick}
            className={"flex h-11 w-11 items-center justify-center rounded-xl border " + transitionClass + " hover:bg-[var(--app-nav-hover-bg)]"}
            style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-nav-icon)" }}
            aria-label="Filters"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        )}
        {filterOptions}
        {onSearchChange && (
          <div className="relative w-full sm:min-w-[220px] sm:max-w-xs lg:w-auto">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: "var(--app-search-placeholder)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-11 w-full rounded-xl border py-2 pl-10 pr-4 text-base outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useUi } from "@/context/ui-context";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

export function Navbar() {
  const { toggleSidebar } = useUi();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 md:px-6 backdrop-blur"
      style={{
        backgroundColor: "rgb(255 255 255 / 0.85)",
        borderColor: "var(--app-navbar-border)",
      }}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="md:hidden flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: "var(--app-nav-icon)" }}
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search */}
      <div className="relative hidden flex-1 max-w-md sm:block">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--app-search-placeholder)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search students, fees, parents…"
          className="h-9 w-full rounded-lg border py-1.5 pl-9 pr-12 text-sm outline-none transition-all"
          style={{
            backgroundColor: "var(--app-search-bg)",
            borderColor: "var(--app-search-border)",
            color: "var(--app-text-primary)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--app-brand)";
            e.currentTarget.style.boxShadow = "var(--shadow-focus)";
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--app-search-border)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.backgroundColor = "var(--app-search-bg)";
          }}
        />
        <kbd
          className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 items-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold tracking-wide text-slate-400"
        >
          ⌘ K
        </kbd>
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Right cluster */}
      <nav className="flex items-center gap-1">
        <NotificationBell />

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: "var(--app-nav-icon)" }}
          aria-label="Help"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

      </nav>
    </header>
  );
}

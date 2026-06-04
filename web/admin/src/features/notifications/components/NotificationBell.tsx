"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";
import { useNotifications } from "../hooks/useNotifications";
import { notificationTypeMeta, type NotificationItem } from "../types";

/**
 * Header notification bell: unread badge + a dropdown of the latest items.
 * Clicking an item marks it read and follows its in-app link. The list is
 * already role-scoped by the API, so each user only sees what's relevant.
 */
export function NotificationBell() {
  const router = useRouter();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const recent = items.slice(0, 8);

  function openItem(n: NotificationItem) {
    void markRead(n.id);
    setOpen(false);
    if (n.linkUrl) router.push(n.linkUrl);
    else router.push("/notifications");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: "var(--app-nav-icon)" }}
        aria-label="Notifications"
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            style={{ backgroundColor: "var(--app-danger)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border bg-white shadow-xl sm:w-96"
          style={{ borderColor: "var(--app-card-border)" }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-bold text-[var(--app-text-primary)]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((n) => {
                  const meta = notificationTypeMeta(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                        style={{ backgroundColor: n.isRead ? undefined : "rgba(99,102,241,0.04)" }}
                      >
                        <span
                          className="mt-0.5 inline-flex h-fit flex-shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--app-text-primary)]">
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--app-brand)]" />
                            )}
                          </span>
                          {n.body && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--app-text-secondary)]">
                              {n.body}
                            </span>
                          )}
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

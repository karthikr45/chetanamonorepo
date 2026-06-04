"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { notificationTypeMeta, type NotificationItem } from "@/features/notifications/types";

type TabId = "all" | "unread" | "approval" | "template" | "announcement" | "chat";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "approval", label: "Approvals" },
  { id: "template", label: "Templates" },
  { id: "announcement", label: "Announcements" },
  { id: "chat", label: "Messages" },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { items, unreadCount, loading, error, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<TabId>("all");

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "unread") return items.filter((n) => !n.isRead);
    return items.filter((n) => n.type === tab);
  }, [items, tab]);

  function open(n: NotificationItem) {
    void markRead(n.id);
    if (n.linkUrl) router.push(n.linkUrl);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--app-text-primary)]">
            Notifications
          </h1>
          <p className="text-sm text-[var(--app-text-secondary)]">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-[var(--app-brand)] transition-colors hover:bg-slate-50"
            style={{ borderColor: "var(--app-card-border)" }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border p-1" style={{ backgroundColor: "#f3f4f6", borderColor: "var(--app-divider)" }}>
        {TABS.map(({ id, label }) => {
          const count =
            id === "unread"
              ? unreadCount
              : id === "all"
                ? items.length
                : items.filter((n) => n.type === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={
                tab === id
                  ? { backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }
                  : { color: "var(--app-text-secondary)" }
              }
            >
              {label}
              {count > 0 && <span className="ml-1.5 text-xs text-slate-400">{count}</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">No notifications here.</p>
        )}

        {filtered.map((n) => {
          const meta = notificationTypeMeta(n.type);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className="flex w-full gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              style={{
                borderColor: "var(--app-card-border)",
                backgroundColor: n.isRead ? undefined : "rgba(99,102,241,0.04)",
              }}
            >
              <span
                className="mt-0.5 inline-flex h-fit flex-shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-[var(--app-text-primary)]">
                    {n.title}
                  </h3>
                  {!n.isRead && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--app-brand)]" />}
                </div>
                {n.body && (
                  <p className="mt-0.5 text-sm text-[var(--app-text-secondary)]">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
              </div>
              {n.linkUrl && (
                <svg className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

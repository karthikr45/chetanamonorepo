"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { get, getApiErrorMessage } from "@/lib/api-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false }) as any;

/* ─── Types ─── */
type MediaItem = {
  _id: string;
  name: string;
  url: string;
  branch: string;
  type: string;
  createdAt: string;
  updatedAt: string;
};

function normaliseMediaList(raw: unknown): MediaItem[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? ((raw as { data: unknown[] }).data)
      : [];
  return (list as Array<Record<string, unknown>>).map((m) => ({
    _id: String(m._id ?? m.id ?? ""),
    name: String(m.name ?? m.fileName ?? "Untitled"),
    url: String(m.url ?? ""),
    branch: String(m.branch ?? ""),
    type: String(m.type ?? m.mimeType ?? ""),
    createdAt: String(m.createdAt ?? new Date().toISOString()),
    updatedAt: String(m.updatedAt ?? m.createdAt ?? new Date().toISOString()),
  }));
}

const TABS = [
  { id: "audio" as const, label: "Audio" },
  { id: "video" as const, label: "Video" },
];

type TabId = "audio" | "video";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFileName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\.\w+$/, "");
}

/* ─── Audio Card ─── */
function AudioCard({ item }: { item: MediaItem }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-md"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
    >
      {/* Top row: icon + info */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--app-search-bg)" }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--app-text-primary)" }} title={item.name}>
            {formatFileName(item.name)}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--app-text-secondary)" }}>
            {formatDate(item.createdAt)} &middot; {item.branch.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Audio player with native controls (play, seek, volume) */}
      <ReactPlayer
        src={item.url}
        controls
        width="100%"
        height={40}
      />
    </div>
  );
}

/* ─── Video Card ─── */
function VideoCard({ item }: { item: MediaItem }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
    >
      <div className="relative aspect-video w-full bg-black">
        <ReactPlayer
          src={item.url}
          controls
          width="100%"
          height="100%"
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--app-search-bg)" }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--app-text-primary)" }} title={item.name}>
            {formatFileName(item.name)}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--app-text-secondary)" }}>
            {formatDate(item.createdAt)} &middot; {item.branch.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Content ─── */
export function ViewMediaPageContainer() {
  const [activeTab, setActiveTab] = useState<TabId>("audio");
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    get<unknown>("/media")
      .then((res) => {
        if (cancelled) return;
        setAllItems(normaliseMediaList(res));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "Could not load media"));
        setAllItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = allItems.filter((m) =>
    activeTab === "audio"
      ? /^audio\//i.test(m.type)
      : /^video\//i.test(m.type),
  );

  return (
    <div className="space-y-1">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          View Media
        </h1>
        <div
          className="flex items-center gap-1 rounded-xl border p-1"
          style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)" }}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === id ? "shadow-sm" : "hover:bg-[var(--app-nav-hover-bg)]"
              }`}
              style={
                activeTab === id
                  ? { backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }
                  : { color: "var(--app-text-secondary)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Count badge */}
      <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
        {loading
          ? "Loading…"
          : `${items.length} ${activeTab === "audio" ? "audio" : "video"} file${items.length !== 1 ? "s" : ""}`}
      </p>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Media grid */}
      {loading ? null : items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-20"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
        >
          <svg className="mb-3 h-12 w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--app-text-secondary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--app-text-secondary)" }}>
            No {activeTab} files found
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${activeTab === "video" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {items.map((item) =>
            activeTab === "audio" ? (
              <AudioCard key={item._id} item={item} />
            ) : (
              <VideoCard key={item._id} item={item} />
            )
          )}
        </div>
      )}

    </div>
  );
}

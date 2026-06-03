"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface FeedPost {
  id: string;
  kind: "POST" | "EVENT" | "ANNOUNCEMENT";
  title: string;
  excerpt: string | null;
  body: string;
  eventAt: string | null;
  location: string | null;
  authorName: string | null;
  createdAt: string;
  images: { url: string; alt: string | null }[];
  tenantName: string | null;
  commentCount: number;
  reactionCount: number;
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) return (res as { data: T }).data;
  return res as T;
}

/**
 * Parent-portal social feed. Looks similar to the public /feed but
 * is tenant-scoped (only the parent's school's posts) and uses
 * the authed /social/feed endpoint so private posts in the same tenant
 * appear too.
 */
export function ParentFeedContent() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/social/feed?limit=40");
      setPosts(unwrap<FeedPost[]>(res.data));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not load the feed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function like(p: FeedPost) {
    setBusyPostId(p.id);
    try {
      const res = await api.post(`/social/${p.id}/like`, {});
      const r = unwrap<{ liked: boolean; total: number }>(res.data);
      setPosts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, reactionCount: r.total } : x)),
      );
    } catch {
      /* swallow */
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafaf7] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            ← Dashboard
          </Link>
          <h1 className="text-base font-bold text-slate-900">School Feed</h1>
          <span className="w-16" />
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">
            No posts yet. Check back soon.
          </p>
        ) : (
          <ul className="space-y-8">
            {posts.map((p) => (
              <li
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                {p.images[0] && (
                  <img
                    src={p.images[0].url}
                    alt={p.images[0].alt ?? p.title}
                    className="w-full max-h-[480px] object-cover"
                  />
                )}
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                    {p.kind}
                    {p.tenantName ? ` · ${p.tenantName}` : ""}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 leading-snug">
                    {p.title}
                  </h2>
                  {p.excerpt && <p className="text-sm text-slate-600 mt-1">{p.excerpt}</p>}
                  {p.kind === "EVENT" && p.eventAt && (
                    <p className="mt-2 text-xs font-semibold text-[#6c739c]">
                      🗓{" "}
                      {new Date(p.eventAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {p.location ? ` · ${p.location}` : ""}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <button
                      onClick={() => like(p)}
                      disabled={busyPostId === p.id}
                      className="inline-flex items-center gap-1 hover:text-red-500 disabled:opacity-50"
                    >
                      ♥ {p.reactionCount}
                    </button>
                    <span>·</span>
                    <span>💬 {p.commentCount}</span>
                    <span className="ml-auto">{p.authorName ?? "Staff"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listPublicFeedApi,
  type SocialPost,
} from "@/features/social/api/social.api";

/**
 * Public, no-auth feed. Premium look — display serif headlines,
 * generous whitespace, large imagery. Designed to be the school's
 * "shop window" for prospective families.
 */
export function PublicFeedContent() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicFeedApi({ limit: 60 })
      .then((res) => {
        if (!cancelled) setPosts(res);
      })
      .catch((e) => {
        if (!cancelled) setError("Could not load the feed. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#fafaf7] text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <div className="absolute -top-32 -right-24 h-[480px] w-[480px] rounded-full bg-[#6c739c] blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-[480px] w-[480px] rounded-full bg-amber-500 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-12">
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#6c739c] text-white font-black"
                style={{ fontFamily: "var(--font-display)" }}
              >
                S
              </span>
              SVBK
            </Link>
            <Link
              href="/"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Sign in →
            </Link>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#6c739c] mb-3">
            Our Story · Live Feed
          </p>
          <h1
            className="text-[44px] sm:text-[64px] leading-[0.95] font-black text-slate-900 max-w-3xl"
            style={{
              fontFamily: "var(--font-display), serif",
              letterSpacing: "-0.02em",
            }}
          >
            Where every child's milestone <em className="italic text-[#6c739c]">is celebrated</em>.
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl leading-relaxed">
            Annual day, sports, science fair, art exhibitions — moments from
            the SVBK family, shared as they happen. No account required.
          </p>
        </div>
      </section>

      {/* Feed */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        {loading ? (
          <p className="text-sm text-slate-500">Loading the feed…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center">
            <p
              className="text-2xl font-black text-slate-900 mb-2"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              The story starts soon.
            </p>
            <p className="text-sm text-slate-500">
              Our school will be posting updates here. Check back in a bit.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p, idx) => (
              <FeedCard key={p.id} post={p} featured={idx === 0} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <span>© SVBK · Stories from our schools</span>
          <Link href="/" className="font-semibold text-slate-700 hover:text-slate-900">
            Admin portal →
          </Link>
        </div>
      </footer>
    </main>
  );
}

function FeedCard({ post, featured }: { post: SocialPost; featured?: boolean }) {
  const cover = post.images[0];
  const isEvent = post.kind === "EVENT";
  return (
    <Link
      href={`/feed/${post.id}`}
      className={`group rounded-3xl overflow-hidden bg-white border border-slate-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 block ${
        featured ? "md:col-span-2 lg:col-span-2 lg:row-span-2" : ""
      }`}
    >
      {cover ? (
        <div className={`relative ${featured ? "h-[420px]" : "h-56"} overflow-hidden bg-slate-100`}>
          <img
            src={cover.url}
            alt={cover.alt ?? post.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <span className="absolute top-4 left-4 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] bg-white/90 backdrop-blur text-slate-800">
            {post.kind}
          </span>
        </div>
      ) : (
        <div className="h-56 bg-gradient-to-br from-[#6c739c]/10 via-amber-50 to-violet-50 flex items-center justify-center">
          <span className="text-5xl">{isEvent ? "🗓" : post.kind === "ANNOUNCEMENT" ? "📣" : "📝"}</span>
        </div>
      )}
      <div className={`p-6 ${featured ? "lg:p-8" : ""}`}>
        {post.tenantName && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
            {post.tenantName}
          </p>
        )}
        <h2
          className={`font-black text-slate-900 leading-[1.1] ${featured ? "text-3xl lg:text-4xl" : "text-xl"}`}
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className={`text-slate-600 mt-3 leading-relaxed ${featured ? "text-base" : "text-sm line-clamp-3"}`}>
            {post.excerpt}
          </p>
        )}
        {isEvent && post.eventAt && (
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6c739c]">
            <span>🗓</span>
            {new Date(post.eventAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {post.location ? ` · ${post.location}` : ""}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
          <span>{post.authorName ?? "Staff"}</span>
          <span>
            {new Date(post.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}

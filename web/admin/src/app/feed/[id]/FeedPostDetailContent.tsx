"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicPostApi, type SocialPost } from "@/features/social/api/social.api";
import { get } from "@/lib/api-client";

interface PublicComment {
  id: string;
  postId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) return (res as { data: T }).data;
  return res as T;
}

/**
 * Full-post detail view, accessible without login. Reads the body
 * HTML produced by the rich-text editor and renders it. Photo gallery
 * sits below the headline. Comment thread shown at the bottom — the
 * compose box only appears for logged-in users (admin or parent).
 */
export function FeedPostDetailContent({ id }: { id: string }) {
  const [post, setPost] = useState<SocialPost | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const p = await getPublicPostApi(id);
        if (!cancelled) setPost(p);
        const cs = unwrap<PublicComment[]>(
          await get(`/social/public/posts/${id}/comments`),
        );
        if (!cancelled) setComments(cs);
      } catch {
        if (!cancelled) setError("Couldn’t load this story.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="min-h-screen flex items-center justify-center text-slate-500">Loading…</p>;
  }
  if (error || !post) {
    return (
      <main className="min-h-screen bg-[#fafaf7] flex items-center justify-center px-6">
        <div className="text-center">
          <p
            className="text-3xl font-black text-slate-900 mb-2"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Not found
          </p>
          <p className="text-sm text-slate-500 mb-4">{error ?? "This story isn’t available."}</p>
          <Link href="/feed" className="text-[#6c739c] font-semibold hover:underline">
            ← Back to feed
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafaf7]">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            ← Back
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-4 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        {post.tenantName && (
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">
            {post.tenantName} · {post.kind}
          </p>
        )}
        <h1
          className="text-[40px] sm:text-[56px] leading-[1.02] font-black text-slate-900"
          style={{ fontFamily: "var(--font-display), serif", letterSpacing: "-0.02em" }}
        >
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">{post.excerpt}</p>
        )}
        <div className="mt-5 flex items-center gap-4 text-xs text-slate-500">
          <span>{post.authorName ?? "Staff"}</span>
          <span>·</span>
          <span>
            {new Date(post.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          {post.kind === "EVENT" && post.eventAt && (
            <>
              <span>·</span>
              <span className="text-[#6c739c] font-semibold">
                🗓{" "}
                {new Date(post.eventAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {post.location ? ` · ${post.location}` : ""}
              </span>
            </>
          )}
        </div>

        {/* Gallery */}
        {post.images.length > 0 && (
          <section className="mt-10">
            <div className="rounded-3xl overflow-hidden bg-slate-100 aspect-[16/10]">
              <img
                src={post.images[active]?.url}
                alt={post.images[active]?.alt ?? ""}
                className="w-full h-full object-cover"
              />
            </div>
            {post.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {post.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                      i === active ? "border-[#6c739c]" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Body */}
        {post.body && (
          <section
            className="mt-10 prose-feed"
            // Body HTML is produced by the rich-text editor (Quill) on
            // the admin side; same provenance as any school's CMS.
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        )}

        {/* Comments */}
        <section className="mt-16 border-t border-slate-200 pt-10">
          <h3
            className="text-2xl font-black text-slate-900 mb-5"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {comments.length === 0
              ? "Be the first to comment"
              : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
          </h3>
          {comments.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sign in to leave a comment.{" "}
              <Link href="/" className="text-[#6c739c] font-semibold hover:underline">
                Sign in →
              </Link>
            </p>
          ) : (
            <ul className="space-y-5">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[#6c739c]/10 text-[#6c739c] font-bold flex items-center justify-center text-sm">
                    {(c.authorName ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-sm text-slate-900">
                        {c.authorName ?? "Anonymous"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(c.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      <style jsx global>{`
        .prose-feed {
          font-size: 17px;
          line-height: 1.7;
          color: #334155;
        }
        .prose-feed h1, .prose-feed h2, .prose-feed h3 {
          font-family: var(--font-display), serif;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin: 1.6em 0 0.4em;
          line-height: 1.15;
        }
        .prose-feed h1 { font-size: 1.9em; font-weight: 800; }
        .prose-feed h2 { font-size: 1.5em; font-weight: 800; }
        .prose-feed h3 { font-size: 1.2em; font-weight: 700; }
        .prose-feed p { margin: 1em 0; }
        .prose-feed a { color: #6c739c; text-decoration: underline; text-underline-offset: 3px; }
        .prose-feed img { border-radius: 12px; margin: 1.5em auto; max-width: 100%; }
        .prose-feed ul, .prose-feed ol { padding-left: 1.5em; margin: 1em 0; }
        .prose-feed li { margin: 0.4em 0; }
        .prose-feed blockquote { border-left: 3px solid #6c739c; padding-left: 1em; color: #475569; font-style: italic; margin: 1.5em 0; }
      `}</style>
    </main>
  );
}

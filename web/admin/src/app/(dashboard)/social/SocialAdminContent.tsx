"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createPostApi,
  deletePostApi,
  listAdminPostsApi,
  updatePostApi,
  uploadSocialImageApi,
  type SocialImage,
  type SocialPost,
  type SocialPostKind,
} from "@/features/social/api/social.api";

type FormState = {
  id: string | null;
  title: string;
  kind: SocialPostKind;
  excerpt: string;
  body: string;
  eventAt: string;
  location: string;
  tags: string;
  isPublic: boolean;
  isPublished: boolean;
  images: SocialImage[];
};

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  kind: "POST",
  excerpt: "",
  body: "",
  eventAt: "",
  location: "",
  tags: "",
  isPublic: true,
  isPublished: true,
  images: [],
};

export function SocialAdminContent() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPosts(await listAdminPostsApi({ limit: 60 }));
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load feed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew(kind: SocialPostKind) {
    setForm({ ...EMPTY_FORM, kind });
    setShowEditor(true);
  }

  function openEdit(p: SocialPost) {
    setForm({
      id: p.id,
      title: p.title,
      kind: p.kind,
      excerpt: p.excerpt ?? "",
      body: p.body ?? "",
      eventAt: p.eventAt ? p.eventAt.slice(0, 16) : "",
      location: p.location ?? "",
      tags: p.tags ?? "",
      isPublic: p.isPublic,
      isPublished: p.isPublished,
      images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? undefined })),
    });
    setShowEditor(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        kind: form.kind,
        excerpt: form.excerpt.trim() || undefined,
        body: form.body,
        eventAt: form.eventAt
          ? new Date(form.eventAt).toISOString()
          : form.kind === "EVENT"
            ? undefined
            : null,
        location: form.location.trim() || undefined,
        tags: form.tags.trim() || undefined,
        isPublic: form.isPublic,
        isPublished: form.isPublished,
        images: form.images.map((i) => ({ url: i.url, alt: i.alt ?? undefined })),
      };
      if (form.id) {
        await updatePostApi(form.id, body);
      } else {
        await createPostApi(body);
      }
      setShowEditor(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: SocialPost) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await deletePostApi(p.id);
      load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not delete"));
    }
  }

  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        if (!/^image\//.test(f.type)) continue;
        const { url } = await uploadSocialImageApi(f);
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, { url, alt: f.name }],
        }));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Upload failed. Check the tenant Azure storage settings."));
    } finally {
      setUploading(false);
    }
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setForm((prev) => {
      const next = [...prev.images];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...prev, images: next };
    });
  }

  function removeImage(idx: number) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  const isEvent = form.kind === "EVENT";

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Social feed
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Author school posts, events and announcements that appear on the
            public feed and the parent/student portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openNew("EVENT")}>
            + Event
          </Button>
          <Button variant="primary" onClick={() => openNew("POST")}>
            + Post
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <Card padding="default">
          <p className="text-sm text-slate-500 text-center py-8">
            No posts yet. Click <strong>+ Post</strong> or <strong>+ Event</strong> to
            create the first one.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => (
            <Card key={p.id} padding="none" className="overflow-hidden">
              {p.images[0] ? (
                <img
                  src={p.images[0].url}
                  alt={p.images[0].alt ?? p.title}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-300 text-3xl">
                  {p.kind === "EVENT" ? "🗓" : p.kind === "ANNOUNCEMENT" ? "📣" : "📝"}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] ${kindBadge(p.kind)}`}
                  >
                    {p.kind}
                  </span>
                  {!p.isPublished && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700">
                      Draft
                    </span>
                  )}
                  {!p.isPublic && p.isPublished && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                      Tenant only
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 leading-snug">{p.title}</h3>
                {p.excerpt && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{p.excerpt}</p>
                )}
                {p.eventAt && (
                  <p className="mt-2 text-[11px] text-slate-500">
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
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <button
                    onClick={() => openEdit(p)}
                    className="font-semibold text-[#6c739c] hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="font-semibold text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                  <span className="ml-auto text-slate-400">
                    {p.images.length} {p.images.length === 1 ? "image" : "images"}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Public feed:{" "}
        <Link href="/feed" target="_blank" className="text-[#6c739c] font-semibold hover:underline">
          /feed →
        </Link>
      </p>

      {showEditor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setShowEditor(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {form.id ? "Edit" : "New"} {isEvent ? "event" : form.kind === "ANNOUNCEMENT" ? "announcement" : "post"}
              </h2>
              <button onClick={() => setShowEditor(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Kind" className="sm:col-span-1">
                  <select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as SocialPostKind })}
                    className="form-input-x"
                  >
                    <option value="POST">Post</option>
                    <option value="EVENT">Event</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                  </select>
                </Field>
                <Field label="Title *" className="sm:col-span-2">
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Annual Day 2025"
                    className="form-input-x"
                    maxLength={200}
                  />
                </Field>
              </div>

              <Field label="Short excerpt (shown on feed cards)">
                <input
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  placeholder="One-line summary for the feed"
                  className="form-input-x"
                  maxLength={280}
                />
              </Field>

              {isEvent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="When">
                    <input
                      type="datetime-local"
                      value={form.eventAt}
                      onChange={(e) => setForm({ ...form, eventAt: e.target.value })}
                      className="form-input-x"
                    />
                  </Field>
                  <Field label="Where">
                    <input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="School auditorium"
                      className="form-input-x"
                      maxLength={200}
                    />
                  </Field>
                </div>
              )}

              <Field label="Body">
                <RichTextEditor
                  value={form.body}
                  onChange={(v) => setForm({ ...form, body: v })}
                  placeholder="Write the full story. Use formatting, images, links…"
                />
              </Field>

              {/* Image gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Photos ({form.images.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-xs font-semibold text-[#6c739c] hover:underline disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "+ Add images"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => onFiles(e.target.files)}
                  />
                </div>
                {form.images.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    Drop or pick photos to attach. The first one is used as the cover.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {form.images.map((img, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200">
                        <img src={img.url} alt={img.alt ?? ""} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => moveImage(i, -1)}
                            className="text-white text-xs px-1.5 py-0.5 rounded bg-black/50 hover:bg-black/70 disabled:opacity-30"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={i === form.images.length - 1}
                            onClick={() => moveImage(i, 1)}
                            className="text-white text-xs px-1.5 py-0.5 rounded bg-black/50 hover:bg-black/70 disabled:opacity-30"
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="text-white text-xs px-1.5 py-0.5 rounded bg-red-500/80 hover:bg-red-500"
                          >
                            ✕
                          </button>
                        </div>
                        {i === 0 && (
                          <span className="absolute top-1 left-1 bg-[#6c739c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            COVER
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Tags (comma-separated, optional)">
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="sports, annual-day, photos"
                  className="form-input-x"
                  maxLength={300}
                />
              </Field>

              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isPublic}
                    onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Visible publicly (no login)
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Published
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={save} isLoading={saving}>
                  {form.id ? "Save changes" : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.form-input-x) {
          height: 38px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.form-input-x:focus) {
          border-color: #6c739c;
          box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
        }
      `}</style>
    </div>
  );
}

function kindBadge(k: string): string {
  if (k === "EVENT") return "bg-amber-50 text-amber-700";
  if (k === "ANNOUNCEMENT") return "bg-violet-50 text-violet-700";
  return "bg-[#f7ece9] text-[#6c739c]";
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

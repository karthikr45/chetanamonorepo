"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { saveTemplate } from "@/features/templates";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredUser } from "@/features/auth/services";

type FormState = {
  name: string;
  message: string;
  category: string;
};

const INITIAL: FormState = {
  name: "",
  message: "",
  category: "",
};

function PhonePreview({ form }: { form: FormState }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
        Preview
      </p>
      <div
        className="relative w-[260px] sm:w-[280px] rounded-[2rem] border-[3px] p-2"
        style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-search-bg)" }}
      >
        <div className="mx-auto mb-2 h-5 w-20 rounded-full" style={{ backgroundColor: "var(--app-divider)" }} />
        <div className="min-h-[300px] sm:min-h-[360px] rounded-2xl p-3" style={{ backgroundColor: "#e5ddd5" }}>
          <div className="max-w-[210px] sm:max-w-[220px] rounded-xl rounded-tl-sm bg-white p-3 shadow-sm">
            {form.message && form.message !== "<p><br></p>" ? (
              <div
                className="prose-preview whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-700 [&_p]:m-0 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-[11px] [&_h3]:font-bold [&_ul]:ml-3 [&_ul]:list-disc [&_ol]:ml-3 [&_ol]:list-decimal [&_a]:text-[#6c739c] [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: form.message }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-700">
                Your message will appear here...
              </p>
            )}
            <p className="mt-1 text-right text-[9px] text-zinc-400">12:00 PM</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <div className="h-8 flex-1 rounded-full" style={{ backgroundColor: "var(--app-divider)" }} />
          <div className="h-8 w-8 rounded-full" style={{ backgroundColor: "var(--app-divider)" }} />
        </div>
      </div>
    </div>
  );
}

export function SaveTemplatePageContent() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const messagePlainText = form.message.replace(/<[^>]*>/g, "").trim();
  const canSubmit = form.name.trim() && messagePlainText;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await saveTemplate({
        name: form.name.trim(),
        message: form.message,
        ...(form.category.trim() ? { category: form.category.trim() } : {}),
        adminId: getStoredUser()?.id ?? "",
      });
      router.push("/templates");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save template. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-brand)]/20";

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/templates")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-(--app-nav-hover-bg)"
          style={{ color: "var(--app-text-secondary)" }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold sm:text-2xl" style={{ color: "var(--app-text-primary)" }}>
          Create Template
        </h1>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Form */}
        <div
          className="flex-1 space-y-5 rounded-xl border p-4 sm:p-6"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
        >
          {/* Template Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
              placeholder="e.g. Fee Reminder"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Message <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={form.message}
              onChange={(val) => set("message", val)}
              placeholder="Enter message body. Use {{1}}, {{2}} for variables."
            />
            <p className="text-[11px]" style={{ color: "var(--app-text-secondary)" }}>
              {form.message.replace(/<[^>]*>/g, "").length} / 1024 characters
            </p>
          </div>

          {/* Create Category (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Create Category
            </label>
            <input
              className={inputCls}
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
              placeholder="e.g. Promotions (optional)"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit || saving}
              className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Template"
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push("/templates")}
              className="h-10 w-full sm:w-auto rounded-xl border px-6 text-sm font-medium transition-colors hover:bg-(--app-nav-hover-bg)"
              style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Preview — hidden on mobile, shown from xl up */}
        <div className="hidden xl:block xl:w-[320px] 2xl:w-[360px]">
          <div
            className="sticky top-6 rounded-xl border p-5"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <PhonePreview form={form} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { useFetchApprovedTemplates } from "@/features/templates";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

const FALLBACK_CLASSES = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
];

type ScheduleType = "now" | "later";

type FormState = {
  templateId: string;
  title: string;
  message: string;
  classes: string[];
  scheduleType: ScheduleType;
  scheduleDate: string;
  scheduleTime: string;
};

const INITIAL: FormState = {
  templateId: "",
  title: "",
  message: "",
  classes: [],
  scheduleType: "now",
  scheduleDate: "",
  scheduleTime: "",
};

function ClassMultiSelect({
  selected,
  onChange,
  classes: CLASSES,
}: {
  selected: string[];
  onChange: (classes: string[]) => void;
  classes: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (cls: string) => {
    onChange(selected.includes(cls) ? selected.filter((c) => c !== cls) : [...selected, cls]);
  };

  const toggleAll = () => {
    onChange(selected.length === CLASSES.length ? [] : [...CLASSES]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors"
        style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: selected.length ? "var(--app-text-primary)" : "var(--app-text-secondary)" }}
      >
        <span className="truncate">
          {selected.length === 0
            ? "Select classes"
            : selected.length === CLASSES.length
              ? "All classes"
              : selected.join(", ")}
        </span>
        <svg className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-full rounded-xl border py-1 shadow-lg"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
        >
          <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--app-table-row-hover)]">
            <input
              type="checkbox"
              checked={selected.length === CLASSES.length}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-[var(--app-brand)]"
            />
            <span className="font-medium" style={{ color: "var(--app-text-primary)" }}>Select All</span>
          </label>
          <div className="mx-3 border-t" style={{ borderColor: "var(--app-divider)" }} />
          <div className="max-h-48 overflow-y-auto">
            {CLASSES.map((cls) => (
              <label key={cls} className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm hover:bg-[var(--app-table-row-hover)]">
                <input
                  type="checkbox"
                  checked={selected.includes(cls)}
                  onChange={() => toggle(cls)}
                  className="h-4 w-4 rounded accent-[var(--app-brand)]"
                />
                <span style={{ color: "var(--app-text-primary)" }}>{cls}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnnouncementsPageContent() {
  const { data: templates, loading: templatesLoading } = useFetchApprovedTemplates();
  const classMeta = useMetadata("class", {
    fallback: FALLBACK_CLASSES.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const classOptions = useMemo(
    () => classMeta.options.map((o) => o.label || o.value),
    [classMeta.options],
  );
  const [form, setForm] = useState<FormState>(INITIAL);
  const [sending, setSending] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleTemplateChange = (templateId: string) => {
    set("templateId", templateId);
    if (!templateId) return;
    const tpl = templates.find((t) => t._id === templateId);
    if (tpl) {
      setForm((prev) => ({
        ...prev,
        templateId,
        title: tpl.name,
        message: tpl.body,
      }));
    }
  };

  const bodyPlainText = form.message.replace(/<[^>]*>/g, "").trim();
  const canSubmit =
    form.title.trim() &&
    bodyPlainText &&
    form.classes.length > 0 &&
    (form.scheduleType === "now" || (form.scheduleDate && form.scheduleTime));

  const handleSend = async () => {
    if (!canSubmit) return;
    setSending(true);
    // TODO: call API
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setForm(INITIAL);
  };

  const inputCls =
    "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-brand)]/20";

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Announcements
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Form */}
        <div
          className="flex-1 space-y-5 rounded-xl border p-6"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
        >
          {/* Template selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Select Template
            </label>
            <select
              className={inputCls}
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: form.templateId ? "var(--app-text-primary)" : "var(--app-text-secondary)" }}
              value={form.templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={templatesLoading}
            >
              <option value="">
                {templatesLoading ? "Loading templates..." : "Choose a template (optional)"}
              </option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.category} ({t.language})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
              placeholder="Announcement title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
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
              placeholder="Type your announcement message..."
            />
          </div>

          {/* Classes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Select Classes <span className="text-red-500">*</span>
            </label>
            <ClassMultiSelect
              selected={form.classes}
              onChange={(classes) => set("classes", classes)}
              classes={classOptions}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Schedule
            </label>
            <div className="flex gap-2">
              {([
                { id: "now" as const, label: "Send Now" },
                { id: "later" as const, label: "Schedule Later" },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("scheduleType", id)}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
                  style={
                    form.scheduleType === id
                      ? { backgroundColor: "var(--app-brand)", color: "#fff", borderColor: "var(--app-brand)" }
                      : { borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {form.scheduleType === "later" && (
              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium" style={{ color: "var(--app-text-secondary)" }}>Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
                    value={form.scheduleDate}
                    min={today}
                    onChange={(e) => set("scheduleDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium" style={{ color: "var(--app-text-secondary)" }}>Time</label>
                  <input
                    type="time"
                    className={inputCls}
                    style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
                    value={form.scheduleTime}
                    onChange={(e) => set("scheduleTime", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit || sending}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {sending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {form.scheduleType === "now" ? "Sending..." : "Scheduling..."}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    {form.scheduleType === "now" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  {form.scheduleType === "now" ? "Send Announcement" : "Schedule Announcement"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setForm(INITIAL)}
              className="h-10 rounded-xl border px-6 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)]"
              style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Preview panel */}
        <div className="w-full lg:w-[340px]">
          <div
            className="sticky top-6 space-y-4 rounded-xl border p-5"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Preview
            </p>

            {/* Notification card */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "var(--app-brand)" }}>
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13a3 3 0 005.064 0" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                    {form.title || "Announcement Title"}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--app-text-secondary)" }}>
                    {form.scheduleType === "now"
                      ? "Sending now"
                      : form.scheduleDate && form.scheduleTime
                        ? `Scheduled for ${form.scheduleDate} at ${form.scheduleTime}`
                        : "Schedule pending"}
                  </p>
                </div>
              </div>

              {form.message && form.message !== "<p><br></p>" ? (
                <div
                  className="text-xs leading-relaxed [&_p]:m-0 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-[11px] [&_h3]:font-bold [&_ul]:ml-3 [&_ul]:list-disc [&_ol]:ml-3 [&_ol]:list-decimal [&_a]:text-[#6c739c] [&_a]:underline"
                  style={{ color: "var(--app-text-primary)" }}
                  dangerouslySetInnerHTML={{ __html: form.message }}
                />
              ) : (
                <p className="text-xs" style={{ color: "var(--app-text-secondary)" }}>
                  Your message will appear here...
                </p>
              )}

              {form.classes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {form.classes.map((cls) => (
                    <span
                      key={cls}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: "var(--app-success-bg)", color: "var(--app-success, #166534)" }}
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Template info */}
            {form.templateId && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--app-nav-active-bg)" }}>
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-nav-active-text)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs font-medium" style={{ color: "var(--app-nav-active-text)" }}>
                  Using template: {templates.find((t) => t._id === form.templateId)?.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

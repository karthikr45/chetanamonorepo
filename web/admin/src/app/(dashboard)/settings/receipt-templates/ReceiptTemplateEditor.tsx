"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/common/RichTextEditor";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createTemplateApi,
  getKeysApi,
  getTemplateApi,
  renderTemplatePreviewApi,
  updateTemplateApi,
  type KeyGroup,
  type ReceiptTemplate,
  type ReceiptTemplateKind,
} from "@/features/receipt-templates/api/receipt-templates.api";

const KIND_OPTIONS: { value: ReceiptTemplateKind; label: string }[] = [
  { value: "BOTH", label: "Both online and offline" },
  { value: "ONLINE", label: "Online (gateway) only" },
  { value: "OFFLINE", label: "Offline (cash/cheque/DD/POS/NEFT) only" },
];

type Section = "header" | "body" | "footer";

export function ReceiptTemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const isEdit = !!templateId;

  const [name, setName] = useState("Receipt template");
  const [kind, setKind] = useState<ReceiptTemplateKind>("BOTH");
  const [headerHtml, setHeaderHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyGroups, setKeyGroups] = useState<KeyGroup[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);

  const [activeSection, setActiveSection] = useState<Section>("body");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load template + key list on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await getKeysApi();
        if (!cancelled) setKeyGroups(groups);
      } catch {
        /* non-fatal */
      }
      if (isEdit && templateId) {
        try {
          const t = await getTemplateApi(templateId);
          if (cancelled) return;
          setName(t.name);
          setKind(t.kind);
          setHeaderHtml(t.headerHtml ?? "");
          setBodyHtml(t.bodyHtml ?? "");
          setFooterHtml(t.footerHtml ?? "");
          setIsDefault(t.isDefault);
          setIsActive(t.isActive);
        } catch (err) {
          if (!cancelled) setError(getApiErrorMessage(err, "Could not load template"));
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, templateId]);

  // Live preview: re-render the iframe whenever any section changes.
  const refreshPreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const { html } = await renderTemplatePreviewApi({
        headerHtml,
        bodyHtml,
        footerHtml,
        sample: true,
      });
      setPreviewHtml(html);
    } catch (err) {
      setError(getApiErrorMessage(err, "Preview failed"));
    } finally {
      setPreviewing(false);
    }
  }, [headerHtml, bodyHtml, footerHtml]);

  useEffect(() => {
    const id = window.setTimeout(refreshPreview, 350);
    return () => window.clearTimeout(id);
  }, [refreshPreview]);

  // Copy a placeholder to clipboard — admin pastes it into the rich-text
  // editor wherever they want. Quill doesn't expose a stable cursor API
  // without ref plumbing, so clipboard is the most reliable approach.
  async function copyKey(key: string) {
    const value = `{{${key}}}`;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(value);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = value;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, kind, headerHtml, bodyHtml, footerHtml, isDefault, isActive };
      if (isEdit && templateId) {
        await updateTemplateApi(templateId, body);
      } else {
        await createTemplateApi(body);
      }
      router.push("/settings/receipt-templates");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save template"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-[1500px] mx-auto">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1500px] mx-auto">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? "Edit receipt template" : "New receipt template"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Author HTML with mustache placeholders like{" "}
            <code className="font-mono">{"{{student.name}}"}</code>. The preview
            on the right updates as you type using sample data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} isLoading={saving}>
            {isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        {/* Editor */}
        <div className="space-y-4">
          <Card padding="default">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Template name *">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input-x"
                  maxLength={100}
                />
              </Field>
              <Field label="Applies to">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ReceiptTemplateKind)}
                  className="form-input-x"
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                Use this as the default template
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                Active
              </label>
            </div>
          </Card>

          {/* Tabs */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex border-b border-slate-100">
              {(["header", "body", "footer"] as Section[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                    activeSection === s
                      ? "text-[#6c739c] border-b-2 border-[#6c739c] bg-[#f7ece9]/40"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="p-3">
              {activeSection === "header" && (
                <RichTextEditor
                  value={headerHtml}
                  onChange={setHeaderHtml}
                  placeholder="Header — school logo (Insert → image), name, address"
                />
              )}
              {activeSection === "body" && (
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Body — student, fee and payment details with {{placeholders}}"
                />
              )}
              {activeSection === "footer" && (
                <RichTextEditor
                  value={footerHtml}
                  onChange={setFooterHtml}
                  placeholder="Footer — signature, watermark, disclaimer"
                />
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Tip: use the image button in the toolbar to add a logo. Paste
                placeholders like <code className="font-mono">{"{{student.name}}"}</code>{" "}
                anywhere — they get replaced with real values when the receipt is rendered.
              </p>
            </div>
          </Card>

          {/* Insert key palette */}
          <Card padding="default">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Placeholders</h3>
            <p className="text-xs text-slate-500 mb-3">
              Click any placeholder to copy it. Paste it into the editor where
              you want the real value to appear in the printed receipt.
            </p>
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {keyGroups.map((g) => (
                <div key={g.group}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400 mb-1">
                    {g.group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.keys.map((k) => {
                      const just = copiedKey === k.key;
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() => copyKey(k.key)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                            just
                              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                              : "bg-slate-50 border-slate-200 hover:bg-[#f7ece9] hover:border-[#6c739c]"
                          }`}
                          title={`${k.label} — click to copy`}
                        >
                          <span>{just ? "✓ copied" : `{{${k.key}}}`}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 font-sans">{k.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Preview */}
        <Card padding="none" className="overflow-hidden xl:sticky xl:top-4 xl:self-start">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Live preview</h3>
            <span className="text-[11px] text-slate-400">
              {previewing ? "Updating…" : "Sample data"}
            </span>
          </div>
          <iframe
            title="Receipt preview"
            className="w-full bg-white"
            style={{ height: "calc(100vh - 220px)" }}
            srcDoc={previewHtml}
          />
        </Card>
      </div>

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

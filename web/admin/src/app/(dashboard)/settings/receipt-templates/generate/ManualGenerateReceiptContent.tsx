"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listTemplatesApi,
  renderTemplateApi,
  type ReceiptTemplate,
} from "@/features/receipt-templates/api/receipt-templates.api";

/**
 * "Generate a receipt manually" — pick a template + an existing payment
 * (or fall back to sample data) and render. Useful when the admin wants
 * to reprint a receipt, test a template against a specific payment, or
 * email a payer a one-off copy.
 */
export function ManualGenerateReceiptContent() {
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [useSample, setUseSample] = useState(true);
  const [html, setHtml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTemplatesApi()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        // Prefer the default; otherwise the first one.
        const def = rows.find((r) => r.isDefault) ?? rows[0];
        if (def) setTemplateId(def.id);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e, "Could not load templates"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function render() {
    if (!templateId) {
      setError("Pick a template first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { html } = await renderTemplateApi(templateId, {
        paymentId: useSample ? undefined : paymentId.trim() || undefined,
        sample: useSample,
      });
      setHtml(html);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not render receipt"));
    } finally {
      setBusy(false);
    }
  }

  function printIt() {
    const w = window.open("", "_blank");
    if (!w) {
      setError("Pop-up blocked. Allow pop-ups for this site and try again.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 200);
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Generate a receipt
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Pick a template, optionally choose an existing payment, and render
            a receipt. You can print or save the HTML output.
          </p>
        </div>
        <Link
          href="/settings/receipt-templates"
          className="text-sm text-[#6c739c] hover:underline"
        >
          ← All templates
        </Link>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        <Card padding="default">
          <div className="space-y-4">
            <Field label="Template">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="form-input-x"
              >
                <option value="">— Pick a template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""} · {t.kind}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={useSample}
                  onChange={() => setUseSample(true)}
                />
                Use sample data
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={!useSample}
                  onChange={() => setUseSample(false)}
                />
                Render for an existing payment
              </label>
            </div>

            {!useSample && (
              <Field label="Payment ID">
                <input
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="form-input-x"
                  placeholder="UUID of a fee_payment row"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Find this in Payment Details → Payment history. You can also
                  use the receipt number elsewhere — but this form takes the
                  internal UUID for precision.
                </p>
              </Field>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="primary" onClick={render} isLoading={busy}>
                Render
              </Button>
              <Button variant="secondary" onClick={printIt} disabled={!html}>
                Print
              </Button>
            </div>
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Preview</h3>
          </div>
          {html ? (
            <iframe
              title="Receipt"
              className="w-full bg-white"
              style={{ height: "calc(100vh - 220px)" }}
              srcDoc={html}
            />
          ) : (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Click <strong>Render</strong> to preview the receipt here.
            </div>
          )}
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

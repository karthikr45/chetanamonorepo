"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  correctReceiptSequenceApi,
  getReceiptStatusApi,
  updateReceiptConfigApi,
  type ReceiptFormat,
  type ReceiptResetPolicy,
  type ReceiptStatusResponse,
} from "@/features/payments/api/payments.api";

/** "2026-27" (academic-year period key) → "2627". */
function compactAYFromPeriod(period: string): string {
  const m = period.match(/(\d{4})\D+(\d{2,4})/);
  if (m) return `${m[1].slice(2)}${m[2].slice(-2)}`;
  return period.replace(/\D/g, "");
}

const RESET_POLICY_OPTIONS: { value: ReceiptResetPolicy; label: string }[] = [
  { value: "ACADEMIC_YEAR", label: "Reset per academic year (Apr–Mar)" },
  { value: "YEARLY", label: "Reset per calendar year" },
  { value: "MONTHLY", label: "Reset per month" },
  { value: "DAILY", label: "Reset per day" },
  { value: "NEVER", label: "Never reset (single global sequence)" },
];

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

/**
 * Lets a tenant admin (or super-admin) view, edit, and manually
 * correct the receipt-number sequence for their tenant.
 *
 * Three sections:
 *  - Live preview of the next receipt + the current period counter.
 *  - Edit prefix / reset policy / start number.
 *  - Correct the current running number (use with care).
 *
 * Format: `{PREFIX}-{period}-{####}`. Period is the academic year
 * (Apr–Mar) by default, short-form e.g. "2025-26".
 */
export function ReceiptSequenceContent() {
  const [status, setStatus] = useState<ReceiptStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Editable config (mirrors `status` once loaded).
  const [format, setFormat] = useState<ReceiptFormat>("COMPACT_ACADEMIC");
  const [tenantCode, setTenantCode] = useState("");
  const [prefix, setPrefix] = useState("");
  const [resetPolicy, setResetPolicy] =
    useState<ReceiptResetPolicy>("ACADEMIC_YEAR");
  const [startNumber, setStartNumber] = useState(1);
  const [savingConfig, setSavingConfig] = useState(false);

  // Correction value.
  const [currentValue, setCurrentValue] = useState<string>("");
  const [savingSeq, setSavingSeq] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = unwrap<ReceiptStatusResponse>(await getReceiptStatusApi());
      setStatus(res);
      setFormat(res.format ?? "COMPACT_ACADEMIC");
      setTenantCode(res.tenantCode ?? "");
      setPrefix(res.prefix ?? "");
      setResetPolicy(res.resetPolicy ?? "ACADEMIC_YEAR");
      setStartNumber(res.startNumber ?? 1);
      const cur = res.history.find((h) => h.periodKey === res.currentPeriod);
      setCurrentValue(String(cur?.currentValue ?? 0));
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load receipt status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live preview of what next receipt would be with the current editable values.
  const livePreview = useMemo(() => {
    if (!status) return "";
    const cur = Number(currentValue);
    const next = Number.isFinite(cur) ? cur + 1 : startNumber;
    const padded = String(Math.max(1, next)).padStart(4, "0");
    if (format === "COMPACT_ACADEMIC") {
      const code = (tenantCode || "RCP").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ay = compactAYFromPeriod(status.currentPeriod);
      return `${code}${ay}${padded}`;
    }
    const p = (prefix || "RCP").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const seg = resetPolicy === "NEVER" ? "" : `-${status.currentPeriod}`;
    return `${p}${seg}-${padded}`;
  }, [format, tenantCode, prefix, resetPolicy, startNumber, currentValue, status]);

  async function saveConfig() {
    setSavingConfig(true);
    setError(null);
    setOkMsg(null);
    try {
      await updateReceiptConfigApi({
        receiptFormat: format,
        tenantCode:
          format === "COMPACT_ACADEMIC" ? tenantCode.trim() || undefined : undefined,
        receiptPrefix:
          format === "PREFIXED" ? prefix.trim() || undefined : undefined,
        receiptResetPolicy: resetPolicy,
        receiptStartNumber: Math.max(1, startNumber),
      });
      setOkMsg("Receipt configuration saved.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save configuration"));
    } finally {
      setSavingConfig(false);
    }
  }

  async function correctSequence() {
    const num = Number(currentValue);
    if (!Number.isFinite(num) || num < 0) {
      setError("Current value must be a non-negative number.");
      return;
    }
    if (
      !confirm(
        `Set the running number for ${status?.currentPeriod} to ${num}? ` +
          `The next receipt will be ${num + 1}. Existing receipt numbers on ` +
          `already-posted payments are unchanged.`,
      )
    ) {
      return;
    }
    setSavingSeq(true);
    setError(null);
    setOkMsg(null);
    try {
      await correctReceiptSequenceApi({ currentValue: num });
      setOkMsg("Receipt sequence corrected.");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not correct sequence"));
    } finally {
      setSavingSeq(false);
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Receipt sequence
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">
          Default pattern{" "}
          <code className="font-mono text-slate-700">{"{code}{AAYY}{####}"}</code>{" "}
          — e.g. <code className="font-mono text-slate-700">226270001</code>{" "}
          (school code <strong>2</strong>, academic year <strong>2026-2027</strong>,
          receipt <strong>0001</strong>). The year is your school's academic
          year (April 1 → March 31); the running number resets to 0001 when a
          new academic year starts.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
          {okMsg}
        </div>
      )}

      {loading || !status ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {/* Live preview banner */}
          <Card padding="default" className="mb-5 border-l-4" style={{ borderLeftColor: "var(--app-brand)" }}>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Current period</p>
                <p className="font-semibold text-slate-900">{status.currentPeriod}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Issued so far</p>
                <p className="tabular-nums font-semibold text-slate-900">
                  {status.history.find((h) => h.periodKey === status.currentPeriod)?.currentValue ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Next receipt will be</p>
                <p className="font-mono font-bold text-lg text-[#6c739c]">{livePreview}</p>
              </div>
            </div>
          </Card>

          {/* Edit config */}
          <Card padding="default" className="mb-5">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">Configuration</h3>
              <p className="text-xs text-slate-500">
                Change applies to new receipts only — existing ones keep their original numbers.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Receipt format">
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ReceiptFormat)}
                  className="form-input-x"
                >
                  <option value="COMPACT_ACADEMIC">
                    Compact — {"{code}{AAYY}{####}"} (e.g. 226270001)
                  </option>
                  <option value="PREFIXED">
                    Prefixed — {"{PREFIX}-{period}-{####}"}
                  </option>
                </select>
              </Field>

              {format === "COMPACT_ACADEMIC" ? (
                <Field label="School code (leading digits)">
                  <input
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    placeholder="e.g. 2"
                    maxLength={20}
                    className="form-input-x"
                  />
                </Field>
              ) : (
                <>
                  <Field label="Receipt prefix">
                    <input
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="e.g. SVBK"
                      maxLength={20}
                      className="form-input-x"
                    />
                  </Field>
                  <Field label="Reset policy">
                    <select
                      value={resetPolicy}
                      onChange={(e) => setResetPolicy(e.target.value as ReceiptResetPolicy)}
                      className="form-input-x"
                    >
                      {RESET_POLICY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              <Field label="Start number (fresh periods)">
                <input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="form-input-x"
                />
              </Field>
            </div>
            {format === "COMPACT_ACADEMIC" && (
              <p className="mt-3 text-xs text-slate-500">
                The school code is the leading segment of every receipt number
                (the <strong>2</strong> in <code className="font-mono">226270001</code>).
                Keep it short and unique across schools.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={saveConfig} isLoading={savingConfig}>
                Save configuration
              </Button>
            </div>
          </Card>

          {/* Correct current number */}
          <Card padding="default" className="mb-5">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Correct running number for {status.currentPeriod}
              </h3>
              <p className="text-xs text-slate-500">
                Use this if a receipt was issued by mistake or you need to roll back.
                The next receipt issued becomes <span className="font-semibold">currentValue + 1</span>.
                Existing receipts on posted payments are <strong>not</strong> changed.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Current running number">
                <input
                  type="number"
                  min={0}
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="form-input-x w-40"
                />
              </Field>
              <Button variant="secondary" onClick={correctSequence} isLoading={savingSeq}>
                Apply correction
              </Button>
            </div>
          </Card>

          {/* History */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Sequence history</h3>
              <p className="text-xs text-slate-500">Counter values by period.</p>
            </div>
            {status.history.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">
                No receipts issued yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <Th>Period</Th>
                    <Th align="right">Issued</Th>
                    <Th align="right">Last issued at</Th>
                  </tr>
                </thead>
                <tbody>
                  {status.history.map((h, i) => (
                    <tr
                      key={h.periodKey}
                      className={`hover:bg-slate-50 ${i !== status.history.length - 1 ? "border-b border-slate-50" : ""}`}
                    >
                      <td className="px-5 py-3 font-mono text-slate-900">{h.periodKey}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {h.currentValue}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                        {h.lastIssuedAt
                          ? new Date(h.lastIssuedAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

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
        </>
      )}
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

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicTenant,
  fetchPublicFees,
  initiatePublicPayment,
  verifyPublicPayment,
  publicApiErrorMessage,
  fetchPublicReceiptUrl,
  type PublicTenantInfo,
  type PublicFee,
  type PublicFeesResponse,
} from "@/lib/public-pay";

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

// A payment in flight is stashed here so it survives a gateway redirect
// (UPI / netbanking return to /pay with a fresh page) — on mount we
// rehydrate it and poll until the webhook flips the fee to PAID.
const PENDING_KEY = "svbk_pending_pay";

interface PendingPay {
  feeId: string;
  admissionNumber: string;
  academicYear: string;
}

function savePendingPay(p: PendingPay) {
  if (typeof window !== "undefined")
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

function clearPendingPay() {
  if (typeof window !== "undefined") sessionStorage.removeItem(PENDING_KEY);
}

function readPendingPay(): PendingPay | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingPay;
    return p.feeId && p.admissionNumber && p.academicYear ? p : null;
  } catch {
    return null;
  }
}

export default function PublicPayPage() {
  const [tenant, setTenant] = useState<PublicTenantInfo | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [feesData, setFeesData] = useState<PublicFeesResponse | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feesError, setFeesError] = useState<string | null>(null);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  // A fee whose payment has been started and is awaiting confirmation
  // (from the verify callback or the webhook). Drives the polling effect.
  const [pendingFeeId, setPendingFeeId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // FeePayment id from /verify — drives the Download Receipt button.
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  // FeePayment id whose receipt is currently being generated/opened.
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);

  // Ask the API to generate + store the PDF, then open the returned URL.
  async function openReceipt(feePaymentId: string) {
    setReceiptLoadingId(feePaymentId);
    setPayError(null);
    try {
      const url = await fetchPublicReceiptUrl(
        window.location.host,
        feePaymentId,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setPayError(publicApiErrorMessage(err, "Could not open the receipt."));
    } finally {
      setReceiptLoadingId(null);
    }
  }

  // Read host once on mount, fetch the tenant + AY list.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.host;
    fetchPublicTenant(host)
      .then((t) => {
        setTenant(t);
        const fallback =
          t.academicYears.find((y) => y.isCurrent)?.academicYear ??
          t.academicYears[0]?.academicYear ??
          "";
        // Functional update so a year restored from a pending payment
        // (set synchronously on mount) is not overwritten by the default.
        if (fallback) setAcademicYear((prev) => prev || fallback);
      })
      .catch((err) => {
        setTenantError(
          publicApiErrorMessage(err, "Could not identify the school for this page."),
        );
      });
  }, []);

  // If we returned from a gateway redirect mid-payment, rehydrate the
  // lookup context and mark the fee pending so the polling effect picks
  // it up once the tenant loads.
  useEffect(() => {
    const p = readPendingPay();
    if (!p) return;
    setAdmissionNumber(p.admissionNumber);
    setAcademicYear(p.academicYear);
    setPendingFeeId(p.feeId);
    setPayingFeeId(p.feeId);
  }, []);

  // While a payment is awaiting confirmation, poll the fees endpoint
  // (which reflects webhook updates) until the fee flips to PAID. This is
  // the safety net when the in-page verify callback never fires — e.g.
  // the gateway redirected the browser instead of returning to the modal.
  useEffect(() => {
    if (!pendingFeeId || !tenant) return;
    const admission = admissionNumber.trim();
    if (!admission || !academicYear) return;

    let active = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 45; // ~3 min at 4s intervals
    const host = window.location.host;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!active) return;
      attempts += 1;
      try {
        const res = await fetchPublicFees(host, admission, academicYear);
        if (!active) return;
        setFeesData(res);
        const fee = res.fees.find((f) => f.id === pendingFeeId);
        const paid =
          fee && (fee.paymentStatus === "PAID" || Number(fee.balance) <= 0);
        if (paid) {
          setSuccessMsg("Payment successful.");
          setPayError(null);
          setPayingFeeId(null);
          setPendingFeeId(null);
          clearPendingPay();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (active && attempts < MAX_ATTEMPTS) {
        timer = setTimeout(tick, 4000);
      } else if (active) {
        // Gave up waiting — stop the spinner so the user can retry.
        setPayingFeeId(null);
        setPendingFeeId(null);
        clearPendingPay();
      }
    };

    timer = setTimeout(tick, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pendingFeeId, tenant, admissionNumber, academicYear]);

  const logoSrc = tenant?.logoUrl || "/svbk_logo.webp";
  const isCustomLogo = !!tenant?.logoUrl;

  const canSubmit = useMemo(
    () => !!tenant && !!admissionNumber.trim() && !!academicYear.trim(),
    [tenant, admissionNumber, academicYear],
  );

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !canSubmit) return;
    setLoadingFees(true);
    setFeesError(null);
    setFeesData(null);
    setSuccessMsg(null);
    try {
      const host = window.location.host;
      const res = await fetchPublicFees(host, admissionNumber.trim(), academicYear);
      setFeesData(res);
    } catch (err) {
      setFeesError(publicApiErrorMessage(err, "Could not look up fees."));
    } finally {
      setLoadingFees(false);
    }
  }

  async function refreshFees() {
    if (!tenant) return;
    try {
      const host = window.location.host;
      const res = await fetchPublicFees(host, admissionNumber.trim(), academicYear);
      setFeesData(res);
    } catch {
      /* keep prior list; non-fatal */
    }
  }

  async function pay(fee: PublicFee) {
    if (!tenant) return;
    setPayingFeeId(fee.id);
    setPayError(null);
    setSuccessMsg(null);
    try {
      const host = window.location.host;
      const res = await initiatePublicPayment(host, fee.id);
      const gateway = res.payment.gateway ?? "razorpay";
      const raw = res.gatewayResponse as Record<string, unknown>;
      const orderId =
        res.payment.gatewayOrderId ??
        (raw.id as string | undefined) ??
        (raw.order_id as string | undefined);
      if (!orderId) throw new Error("Gateway did not return an order id.");

      // Stash the in-flight payment so it survives a gateway redirect and
      // the polling effect can confirm it via the webhook-updated fees.
      setPendingFeeId(fee.id);
      savePendingPay({
        feeId: fee.id,
        admissionNumber: admissionNumber.trim(),
        academicYear,
      });

      async function settle(args: {
        gatewayOrderId: string;
        gatewayPaymentId?: string;
        signature?: string;
      }) {
        try {
          const result = await verifyPublicPayment({ host, ...args });
          setSuccessMsg("Payment successful.");
          setLastReceiptId(result.feePaymentId ?? null);
          setPendingFeeId(null);
          clearPendingPay();
          // Re-pull the fee list so the just-paid row flips to PAID
          // and the Pay button disappears.
          await refreshFees();
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } catch (err) {
          // Leave the fee pending so the polling effect can still confirm
          // it once the webhook lands — don't clear pendingFeeId here.
          setPayError(
            publicApiErrorMessage(
              err,
              "Payment was made but confirmation is pending. It will update shortly.",
            ),
          );
        } finally {
          setPayingFeeId(null);
        }
      }

      if (gateway === "razorpay") {
        const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!ok) throw new Error("Failed to load the Razorpay checkout.");
        const w = window as unknown as {
          Razorpay: new (o: unknown) => { open: () => void };
        };
        const rzp = new w.Razorpay({
          key: res.gatewayPublicKey,
          order_id: orderId,
          amount: res.payment.amount,
          currency: res.payment.currency || "INR",
          name: feesData?.student.name ?? "School Fee",
          description: `${fee.term} · ${fee.academicYear}`,
          handler: (r: {
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            void settle({
              gatewayOrderId: orderId,
              gatewayPaymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              setPayingFeeId(null);
              setPendingFeeId(null);
              clearPendingPay();
              setPayError("Payment cancelled.");
            },
          },
        });
        rzp.open();
      } else {
        const sessionId = raw.payment_session_id as string | undefined;
        if (!sessionId) throw new Error("Cashfree session was not created.");
        const ok = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        if (!ok) throw new Error("Failed to load the Cashfree checkout.");
        const w = window as unknown as {
          Cashfree: (o: { mode: string }) => {
            checkout: (o: unknown) => Promise<{ error?: { message?: string } }>;
          };
        };
        // Mode must match what the backend used to create the order
        // (sandbox in dev, production in prod) or the SDK rejects the
        // payment_session_id as invalid.
        const cashfree = w.Cashfree({ mode: res.cashfreeMode ?? "sandbox" });
        const result = await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
          onSuccess: () => {
            void settle({ gatewayOrderId: orderId });
          },
          onFailure: () => {
            setPayingFeeId(null);
            setPendingFeeId(null);
            clearPendingPay();
            setPayError("Cashfree payment failed.");
          },
        });
        if (result?.error) {
          throw new Error(result.error.message ?? "Cashfree payment failed.");
        }
      }
    } catch (err) {
      setPayError(publicApiErrorMessage(err, "Could not start the payment."));
      setPayingFeeId(null);
      setPendingFeeId(null);
      clearPendingPay();
    }
  }

  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-800 mb-2">
            School not found
          </h1>
          <p className="text-sm text-slate-600">{tenantError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-white">
            <Image
              src={logoSrc}
              alt=""
              width={36}
              height={36}
              className="object-contain p-0.5"
              unoptimized={isCustomLogo}
            />
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-800 leading-tight">
              Pay School Fees
            </p>
            <p className="text-[11px] text-slate-500">No login required</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <form
          onSubmit={handleLookup}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Academic year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={!tenant}
            >
              {!tenant && <option>Loading…</option>}
              {tenant?.academicYears.length === 0 && (
                <option value="">No academic years configured</option>
              )}
              {tenant?.academicYears.map((y) => (
                <option key={y.academicYear} value={y.academicYear}>
                  {y.academicYear}
                  {y.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Admission number
            </label>
            <input
              type="text"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
              placeholder="Enter admission number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoCapitalize="characters"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit || loadingFees}
            className="w-full rounded-lg bg-indigo-600 text-white text-sm font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingFees ? "Looking up…" : "View fees"}
          </button>
          {feesError && (
            <p className="text-sm text-red-600">{feesError}</p>
          )}
        </form>

        {feesData && (
          <section className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Student
              </p>
              <p className="text-base font-bold text-slate-800">
                {feesData.student.name}
              </p>
              <p className="text-xs text-slate-500">
                {feesData.student.admissionNumber}
                {feesData.student.class ? ` · Class ${feesData.student.class}` : ""}
                {feesData.student.section ? ` · ${feesData.student.section}` : ""}
                {" · "}
                {feesData.student.academicYear}
              </p>
            </div>

            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-center justify-between gap-3">
                <span>{successMsg}</span>
                {lastReceiptId && (
                  <button
                    onClick={() => openReceipt(lastReceiptId)}
                    disabled={receiptLoadingId === lastReceiptId}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    {receiptLoadingId === lastReceiptId
                      ? "Preparing…"
                      : "Download receipt"}
                  </button>
                )}
              </div>
            )}
            {payError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {payError}
              </div>
            )}

            {feesData.fees.length === 0 && (
              <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-4">
                No fees on record for this admission number and year.
              </p>
            )}

            {feesData.fees.map((f) => {
              const balance = Number(f.balance);
              const paid = f.paymentStatus === "PAID" || balance <= 0;
              return (
                <div
                  key={f.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {f.academicYear}
                      </p>
                      <h3 className="text-base font-bold text-slate-800 mt-0.5">
                        {f.term}
                      </h3>
                    </div>
                    <span
                      className={
                        "text-xs font-bold px-2.5 py-1 rounded-full " +
                        (paid
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-800")
                      }
                    >
                      {paid ? "PAID" : "DUE"}
                    </span>
                  </div>
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Original</span>
                      <span>{inr(f.originalAmount)}</span>
                    </div>
                    {Number(f.totalPenalty) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Penalty</span>
                        <span>+ {inr(f.totalPenalty)}</span>
                      </div>
                    )}
                    {Number(f.totalDiscount) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount</span>
                        <span>− {inr(f.totalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Net</span>
                      <span>{inr(f.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Paid</span>
                      <span>{inr(f.paidAmount)}</span>
                    </div>
                    {balance > 0 && (
                      <div className="flex justify-between font-bold text-red-700">
                        <span>Balance</span>
                        <span>{inr(balance)}</span>
                      </div>
                    )}
                  </div>
                  {!paid && (
                    <button
                      onClick={() => pay(f)}
                      disabled={payingFeeId === f.id || pendingFeeId === f.id}
                      className="mt-4 w-full rounded-lg bg-indigo-600 text-white text-sm font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {pendingFeeId === f.id
                        ? "Confirming payment…"
                        : payingFeeId === f.id
                          ? "Opening checkout…"
                          : `Pay ${inr(balance)}`}
                    </button>
                  )}
                  {paid && f.feePaymentId && (
                    <button
                      onClick={() => openReceipt(f.feePaymentId!)}
                      disabled={receiptLoadingId === f.feePaymentId}
                      className="mt-4 block w-full rounded-lg border border-green-600 text-green-700 text-center text-sm font-semibold py-2.5 hover:bg-green-50 disabled:opacity-60"
                    >
                      {receiptLoadingId === f.feePaymentId
                        ? "Preparing…"
                        : "Download receipt"}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

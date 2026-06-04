"use client";

import { useEffect, useState } from "react";
import {
  initiatePayment,
  fetchActivePaymentConfig,
  verifyParentPayment,
  fetchFees,
  fetchParentReceiptUrl,
  type ActivePaymentConfig,
  type Fee,
  type Gateway,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

// A payment in flight is stashed here (by fee id) so it survives a
// gateway redirect (UPI / netbanking return to the dashboard with a
// fresh page) — on mount the card resumes polling for confirmation.
const PENDING_KEY = "svbk_parent_pending_pay";

function savePendingPay(feeId: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(PENDING_KEY, feeId);
}
function clearPendingPay() {
  if (typeof window !== "undefined") sessionStorage.removeItem(PENDING_KEY);
}
function readPendingPay(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_KEY);
}

// Ask the API to generate + store the PDF in Azure, then open its URL.
async function openReceipt(paymentId: string) {
  try {
    const url = await fetchParentReceiptUrl(paymentId);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    alert(apiErrorMessage(e, "Could not open the receipt"));
  }
}

/** Injects a script tag once; resolves true on load, false on error. */
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

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PAID: { bg: "#dcfce7", text: "#15803d", label: "Paid" },
  PARTIAL: { bg: "#fef3c7", text: "#92400e", label: "Partial" },
  UNPAID: { bg: "#fee2e2", text: "#b91c1c", label: "Unpaid" },
};

function inr(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function FeeCard({
  fee,
  onPaid,
}: {
  fee: Fee;
  onPaid?: () => void;
}) {
  const statusStyle = STATUS_STYLES[fee.paymentStatus] ?? STATUS_STYLES.UNPAID;
  const balance = Number(fee.netAmount) - Number(fee.paidAmount);
  const canPay = balance > 0 && fee.paymentStatus !== "PAID";
  const [paying, setPaying] = useState(false);
  // Awaiting confirmation after checkout opened — covers the case where
  // the gateway redirected (page reloaded) or the in-page callback never
  // fired, and we rely on the webhook flipping the fee to PAID.
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<ActivePaymentConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (!canPay) return;
    let alive = true;
    fetchActivePaymentConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => alive && setConfig(null))
      .finally(() => alive && setConfigLoaded(true));
    return () => {
      alive = false;
    };
  }, [canPay]);

  // If we returned from a gateway redirect mid-payment for THIS fee,
  // resume polling for confirmation.
  useEffect(() => {
    if (readPendingPay() === fee.id) setConfirming(true);
  }, [fee.id]);

  // While confirming, poll this child's fees until our fee flips to PAID
  // (reflecting the webhook update), then refresh the dashboard.
  useEffect(() => {
    if (!confirming) return;
    let active = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 45; // ~3 min at 4s intervals
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!active) return;
      attempts += 1;
      try {
        const fees = await fetchFees(fee.studentId);
        if (!active) return;
        const mine = fees.find((x) => x.id === fee.id);
        const paid =
          mine &&
          (mine.paymentStatus === "PAID" ||
            Number(mine.netAmount) - Number(mine.paidAmount) <= 0);
        if (paid) {
          setConfirming(false);
          setSuccessMsg("Payment successful.");
          setPayError(null);
          clearPendingPay();
          onPaid?.();
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (active && attempts < MAX_ATTEMPTS) {
        timer = setTimeout(tick, 4000);
      } else if (active) {
        setConfirming(false);
        clearPendingPay();
      }
    };

    timer = setTimeout(tick, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [confirming, fee.id, fee.studentId, onPaid]);

  const gatewayReady = !!config?.gatewayType && !!config?.paymentClientId;

  async function settle(args: {
    gatewayOrderId: string;
    gatewayPaymentId?: string;
    signature?: string;
  }) {
    try {
      await verifyParentPayment(args);
      setSuccessMsg("Payment successful. Updating…");
      setConfirming(false);
      clearPendingPay();
      onPaid?.();
    } catch (err) {
      // Leave it confirming so the poller can still pick up the webhook.
      setPayError(
        apiErrorMessage(
          err,
          "Payment was made but confirmation is pending. It will update shortly.",
        ),
      );
    } finally {
      setPaying(false);
    }
  }

  async function handlePay() {
    setPaying(true);
    setPayError(null);
    setSuccessMsg(null);
    try {
      // The server picks the gateway from the RECEIVING tenant's
      // configuration (the tenant that owns the fee — may be a sibling
      // of the parent's home tenant for hostel/transport fees).
      const res = await initiatePayment(fee.id);
      const gateway = (res.payment.gateway ?? "razorpay") as Gateway;
      const raw = res.gatewayResponse as Record<string, unknown>;
      const orderId =
        res.payment?.gatewayOrderId ??
        (raw.id as string | undefined) ??
        (raw.order_id as string | undefined);
      if (!orderId) throw new Error("Gateway did not return an order id.");

      // Stash the in-flight payment and start confirming so we catch the
      // webhook even if the gateway redirects or the callback never fires.
      savePendingPay(fee.id);
      setConfirming(true);

      if (gateway === "razorpay") {
        // Prefer the receiving tenant's public key returned by initiate.
        // Only fall back to the parent-tenant config when the response
        // omits it (older API revisions).
        const clientId =
          res.gatewayPublicKey ??
          config?.paymentClientId ??
          (await fetchActivePaymentConfig()).paymentClientId;
        if (!clientId) {
          throw new Error(
            "Online payment isn't configured for your school yet. " +
              "Please contact the school office.",
          );
        }
        const ok = await loadScript(
          "https://checkout.razorpay.com/v1/checkout.js",
        );
        if (!ok) throw new Error("Failed to load the Razorpay checkout.");
        const w = window as unknown as { Razorpay: new (o: unknown) => { open: () => void } };
        const rzp = new w.Razorpay({
          key: clientId,
          order_id: orderId,
          amount: res.payment.amount,
          currency: res.payment.currency || "INR",
          name: "SVBK",
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
              setPaying(false);
              setConfirming(false);
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
        // Mode must match what the backend used to create the order.
        const cashfree = w.Cashfree({ mode: res.cashfreeMode ?? "sandbox" });
        const result = await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
          onSuccess: () => {
            void settle({ gatewayOrderId: orderId });
          },
          onFailure: () => {
            setPaying(false);
            setConfirming(false);
            clearPendingPay();
            setPayError("Cashfree payment failed.");
          },
        });
        if (result?.error) {
          throw new Error(result.error.message ?? "Cashfree payment failed.");
        }
      }
    } catch (err) {
      setPayError(apiErrorMessage(err, "Could not start the payment."));
      setPaying(false);
      setConfirming(false);
      clearPendingPay();
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {fee.academicYear}
          </p>
          <h3 className="text-base font-bold text-slate-800 mt-0.5">{fee.term}</h3>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
        >
          {statusStyle.label}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Original" value={inr(fee.originalAmount)} />
        {Number(fee.totalPenalty) > 0 && (
          <Row label="Penalty" value={`+ ${inr(fee.totalPenalty)}`} />
        )}
        {Number(fee.totalDiscount) > 0 && (
          <Row label="Discount" value={`− ${inr(fee.totalDiscount)}`} />
        )}
        <Row label="Net" value={inr(fee.netAmount)} bold />
        <Row label="Paid" value={inr(fee.paidAmount)} />
        {balance > 0 && (
          <Row label="Balance" value={inr(balance)} bold valueColor="#b91c1c" />
        )}
      </div>

      {canPay && (
        <div className="mt-4 flex flex-col gap-2">
          {configLoaded && !gatewayReady ? (
            <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              Online payment isn&apos;t available for your school yet. Please
              contact the school office to pay.
            </p>
          ) : (
            <button
              onClick={handlePay}
              disabled={paying || confirming || !configLoaded}
              className="w-full h-10 rounded-lg text-white text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: "#6c739c" }}
            >
              {confirming ? (
                "Confirming payment…"
              ) : paying ? (
                "Working…"
              ) : !configLoaded ? (
                "Loading…"
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                  Pay now · {inr(balance)}
                </>
              )}
            </button>
          )}
          {payError && (
            <p className="text-xs text-red-600" role="alert">{payError}</p>
          )}
          {successMsg && (
            <p className="text-xs text-green-700">{successMsg}</p>
          )}
        </div>
      )}

      {fee.paymentId && (
        <div className="mt-3">
          <button
            onClick={() => openReceipt(fee.paymentId!)}
            className="w-full h-10 rounded-lg border border-[#6c739c] text-[#6c739c] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#6c739c]/5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download receipt
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={bold ? "font-bold text-slate-800" : "text-slate-700"}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

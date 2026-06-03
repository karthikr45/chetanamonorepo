"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get, getApiErrorMessage } from "@/lib/api-client";
import type { StudentFeeRow, TermFeeItem } from "@/features/students/types";
import { createOrder, verifyPayment } from "@/features/students/services/students.service";
import type { CreateOrderResponse } from "@/features/students/api/students.api";
import { on } from "events";
import { getStudentWithFees } from "@/features/payNow/services/payNow.service";
import { useAuth } from "@/features/auth";

function formatCurrency(n?: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export function PaymentPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const admissionNumber = params.get("admissionNumber") ?? "";
  const academicYear = params.get("academicYear") ?? "";
  const termName = params.get("term") ?? "";
  const currency="INR"

  const [student, setStudent] = useState<StudentFeeRow | null>(null);
  const [fee, setFee] = useState<TermFeeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [partialAmountError, setPartialAmountError] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  // Public payment config for the caller's tenant — loaded on mount.
  // Holds the gateway public key (no secret); used to mount Razorpay.
  const [activePayment, setActivePayment] = useState<{
    gatewayType: string | null;
    paymentClientId: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<{ gatewayType: string | null; paymentClientId: string | null }>(
      "/tenant-configs/active-payment",
    )
      .then((res) => {
        if (cancelled) return;
        // Backend may wrap in { data: ... } depending on interceptor.
        const payload =
          (res as { data?: typeof res })?.data ?? (res as typeof res);
        setActivePayment(payload);
      })
      .catch(() => {
        if (!cancelled) setActivePayment({ gatewayType: null, paymentClientId: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!admissionNumber || !academicYear || !termName) {
      setError("Missing payment details. Please go back and try again.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await getStudentWithFees(admissionNumber, academicYear);
        console.log(row,"rowwwwww");
        setStudent(row);
        const termFee = row.termFees[termName];
        if (!termFee) {
          setError(`Term "${termName}" not found for this student.`);
        } else {
          setFee(termFee);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load student details."));
      } finally {
        setLoading(false);
      }
    })();
  }, [admissionNumber, academicYear, termName]);

  /** Dynamically injects a script tag — resolves true on load, false on error. */
  function loadScript(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  function openRazorpayCheckout(order: CreateOrderResponse, paymentDetails: any) {
    const tenantPublicKey = activePayment?.paymentClientId;
    if (!tenantPublicKey) {
      setError(
        "Online payment is not configured for this tenant. Ask your " +
          "tenant admin to add the Razorpay credentials under Configuration.",
      );
      return;
    }

    const effectiveAmount = (
      paymentDetails.discountedAmount &&
      paymentDetails.discountedAmount !== "NA" &&
      paymentDetails.discountedAmount !== "Pending" &&
      paymentDetails.discountedAmount !== "Rejected"
    ) ? paymentDetails.discountedAmount : paymentDetails.amount;

    const options = {
      // Per-tenant public key — fetched from /tenant-configs/active-payment.
      // The matching secret never leaves the server.
      key: tenantPublicKey,

      amount: effectiveAmount * 100, // paise
      order_id: order.orderId,
      currency: "INR",
      name: "SVBK",
      // description: termName,
      handler: function (response: any) {
        verifyPayment(response)
        // dispatch(apiUpdateOrderDetails({ signature: response.razorpay_signature, ... }))
        // dispatch(apiSaveAuditLogs({ ... }))
        setSuccess(true);
      },
      modal: {
        ondismiss: function () {
          // navigate("/admission")
          // dispatch(resetCreateOrderState())
        },
      },
      prefill: {
        // name: payeeDetails.name,
        // email: payeeDetails.email,
        // contact: payeeDetails.phoneNumber,
      },
      // timeout: 480,
      // retry: { enabled: false },
    };

    const _window: any = window;
    const paymentObject = new _window.Razorpay(options);
    paymentObject.open();
  }

  async function openCashfreeCheckout(order: CreateOrderResponse) {
    const _window: any = window;
    // Mode must match the backend's CASHFREE_MODE / NODE_ENV; the
    // order response carries that signal.
    const cashfree = _window.Cashfree({
      mode: order.cashfreeMode ?? "sandbox",
    });
    const result = await cashfree.checkout({
      paymentSessionId: order.paymentSessionId,
      redirectTarget: "_modal",
      onSuccess: (data: any) => {
        verifyPayment(data); 
        
    } ,
     onFailure: (_data: any) => {
  },
  
  });
    
    if (result?.error) {
      setError(result.error.message ?? "Cashfree payment failed.");
    } else if (result?.paymentDetails) {
      setSuccess(true);
    }
  }
  // Gateway is whatever the tenant has configured under
  // tenant_configurations.gateway_type — never hardcoded. The backend
  // normalises to "razorpay" / "cashfree".
  const gateway = (activePayment?.gatewayType ?? "").toLowerCase();

  const getEffectiveTotal = (): number => {
    if (!fee || !student) return 0;
    const paymentDetails: any = student.termFees[termName];
    return (
      paymentDetails.discountedAmount &&
      paymentDetails.discountedAmount !== "NA" &&
      paymentDetails.discountedAmount !== "Pending" &&
      paymentDetails.discountedAmount !== "Rejected"
    ) ? paymentDetails.discountedAmount : paymentDetails.amount;
  };

  const handlePay = async () => {
    if (!fee || !student) return;

    const effectiveTotal = getEffectiveTotal();

    if (paymentMode === "partial") {
      const parsed = parseFloat(partialAmount);
      if (!partialAmount || isNaN(parsed) || parsed <= 0) {
        setPartialAmountError("Please enter a valid amount.");
        return;
      }
      if (parsed > effectiveTotal) {
        setPartialAmountError(`Amount cannot exceed ${formatCurrency(effectiveTotal)}.`);
        return;
      }
    }

    if (!gateway) {
      setError(
        "Online payment is not configured for this tenant yet. " +
          "Ask your tenant admin to add the gateway credentials under Configuration.",
      );
      return;
    }

    setPaying(true);
    setError(null);
    setPartialAmountError(null);
    try {
      const amountToCharge = paymentMode === "partial" ? parseFloat(partialAmount) : effectiveTotal;

      const order = await createOrder(amountToCharge, admissionNumber, academicYear, termName, currency, gateway, student.name, student.email, user?.tenantId ?? "", "online", student.feeId ?? "", student.class, student.rollNo, student.section);

      setPaidAmount(amountToCharge);

      if (gateway === "cashfree") {
        const loaded = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        if (!loaded) throw new Error("Failed to load Cashfree SDK.");
        await openCashfreeCheckout(order);
      } else {
        const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!loaded) throw new Error("Failed to load Razorpay SDK.");
        const paymentDetails: any = student.termFees[termName];
        openRazorpayCheckout(order, paymentDetails);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Payment failed. Please try again."));
    } finally {
      setPaying(false);
    }
  };

  const total = fee ? fee.amount + fee.penaltyAmount : 0;
  const effectiveTotal = getEffectiveTotal();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg" style={{ backgroundColor: "var(--app-divider)" }} />
        <div className="animate-pulse rounded-xl border p-6" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}>
          <div className="mb-4 h-5 w-1/3 rounded" style={{ backgroundColor: "var(--app-divider)" }} />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 rounded" style={{ backgroundColor: "var(--app-divider)", width: `${60 + i * 10}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/pay-now")}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--app-brand)" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Pay Now
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--app-success-bg)" }}>
          <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color: "var(--app-success)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold" style={{ color: "var(--app-text-primary)" }}>Payment Successful!</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--app-text-secondary)" }}>
          {formatCurrency(paidAmount || total)} paid for {termName}
        </p>
        <button
          type="button"
          onClick={() => router.push("/pay-now")}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "var(--app-brand)" }}
        >
          Back to Pay Now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--app-brand)" }}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Payment — {termName}
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: details */}
        <div className="flex-1 space-y-5">
          {/* Student info */}
          {student && (
            <div
              className="rounded-xl border p-5"
              style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
                Student Details
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {[
                  { label: "Name", value: student.name },
                  { label: "Admission No", value: student.admissionNumber },
                  { label: "Class", value: student.class },
                  { label: "Section", value: student.section },
                  { label: "Roll No", value: student.rollNo },
                  { label: "Phone", value: student.phone },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>{value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fee breakup table */}
          {fee && (
            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
            >
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--app-divider)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                  Fee Breakup — {termName}
                </p>
              </div>
              <table className="w-full">
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--app-divider)" }}>
                    <td className="px-5 py-3 text-sm" style={{ color: "var(--app-text-secondary)" }}>Term Fee</td>
                    <td className="px-5 py-3 text-right text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
                      {formatCurrency(fee.originalAmount)}
                    </td>
                  </tr>
                  {/* <tr style={{ borderBottom: "1px solid var(--app-divider)" }}>
                    <td className="px-5 py-3 text-sm" style={{ color: "var(--app-text-secondary)" }}>Penalty Amount</td>
                    <td className="px-5 py-3 text-right text-sm font-medium" style={{ color: fee.penaltyAmount > 0 ? "var(--app-danger)" : "var(--app-text-primary)" }}>
                      {formatCurrency(fee.penaltyAmount)}
                    </td>
                  </tr> */}
                  {fee.paidAmount > 0 && (
                    <tr style={{ borderBottom: "1px solid var(--app-divider)" }}>
                      <td className="px-5 py-3 text-sm" style={{ color: "var(--app-text-secondary)" }}>Already Paid</td>
                      <td className="px-5 py-3 text-right text-sm font-medium" style={{ color: "var(--app-success)" }}>
                        − {formatCurrency(fee.paidAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "var(--app-search-bg)" }}>
                    <td className="px-5 py-4 text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                      Total Payable
                    </td>
                    <td className="px-5 py-4 text-right text-lg font-bold" style={{ color: "var(--app-brand)" }}>
                      {formatCurrency(fee.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Right: payment summary + pay button */}
        <div className="w-full lg:w-[340px]">
          <div
            className="sticky top-6 space-y-4 rounded-xl border p-5"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Payment Summary
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--app-text-secondary)" }}>Term</span>
                <span className="font-medium" style={{ color: "var(--app-text-primary)" }}>{termName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--app-text-secondary)" }}>Fee</span>
                <span className="font-medium" style={{ color: "var(--app-text-primary)" }}>{fee ? formatCurrency(fee.originalAmount) : "—"}</span>
              </div>
              {fee && fee.paidAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--app-text-secondary)" }}>Already Paid</span>
                  <span className="font-medium" style={{ color: "var(--app-success)" }}>− {formatCurrency(fee.paidAmount)}</span>
                </div>
              )}
              <div className="border-t pt-2" style={{ borderColor: "var(--app-divider)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>Total Payable</span>
                  <span className="text-xl font-bold" style={{ color: "var(--app-brand)" }}>
                    {effectiveTotal > 0 ? formatCurrency(effectiveTotal) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment amount selection */}
            <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--app-divider)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
                Amount to Pay
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentMode("full"); setPartialAmount(""); setPartialAmountError(null); }}
                  className="rounded-lg border py-2.5 text-sm font-medium transition-colors"
                  style={
                    paymentMode === "full"
                      ? { backgroundColor: "var(--app-brand)", borderColor: "var(--app-brand)", color: "#fff" }
                      : { backgroundColor: "transparent", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }
                  }
                >
                  Full Amount
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("partial")}
                  className="rounded-lg border py-2.5 text-sm font-medium transition-colors"
                  style={
                    paymentMode === "partial"
                      ? { backgroundColor: "var(--app-brand)", borderColor: "var(--app-brand)", color: "#fff" }
                      : { backgroundColor: "transparent", borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }
                  }
                >
                  Partial Amount
                </button>
              </div>

              {paymentMode === "partial" && (
                <div className="space-y-1">
                  <div
                    className="flex items-center overflow-hidden rounded-lg border"
                    style={{ borderColor: partialAmountError ? "var(--app-danger)" : "var(--app-divider)" }}
                  >
                    <span className="border-r px-3 py-2.5 text-sm font-medium" style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)", backgroundColor: "var(--app-search-bg)" }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={effectiveTotal}
                      value={partialAmount}
                      onChange={(e) => {
                        setPartialAmount(e.target.value);
                        setPartialAmountError(null);
                      }}
                      placeholder={`1 – ${effectiveTotal}`}
                      className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"
                      style={{ color: "var(--app-text-primary)" }}
                    />
                  </div>
                  {partialAmountError && (
                    <p className="text-xs" style={{ color: "var(--app-danger)" }}>{partialAmountError}</p>
                  )}
                  <p className="text-[11px]" style={{ color: "var(--app-text-secondary)" }}>
                    Max: {formatCurrency(effectiveTotal)}
                  </p>
                </div>
              )}

              {/* You pay row */}
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "var(--app-search-bg)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--app-text-secondary)" }}>You pay</span>
                <span className="text-base font-bold" style={{ color: "var(--app-brand)" }}>
                  {paymentMode === "full"
                    ? formatCurrency(effectiveTotal)
                    : partialAmount && !isNaN(parseFloat(partialAmount)) && parseFloat(partialAmount) > 0
                      ? formatCurrency(parseFloat(partialAmount))
                      : "—"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={paying}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {paying ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pay{" "}
                  {paymentMode === "full"
                    ? formatCurrency(effectiveTotal)
                    : partialAmount && !isNaN(parseFloat(partialAmount)) && parseFloat(partialAmount) > 0
                      ? formatCurrency(parseFloat(partialAmount))
                      : ""}
                </>
              )}
            </button>

            <p className="text-center text-[10px]" style={{ color: "var(--app-text-secondary)" }}>
              By clicking Pay, you confirm the payment details are correct.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

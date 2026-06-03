"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  verifyEmailApi,
  resendVerificationApi,
} from "@/features/auth/api/auth.api";
import { getApiErrorMessage } from "@/lib/api-client";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [state, setState] = useState<
    "verifying" | "ok" | "error" | "invalid"
  >(token && email ? "verifying" : "invalid");
  const [message, setMessage] = useState("");
  const [resent, setResent] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token || !email) return;
    ran.current = true;
    verifyEmailApi({ email, token })
      .then((r) => {
        setState("ok");
        setMessage(r.message);
      })
      .catch((err) => {
        setState("error");
        setMessage(
          getApiErrorMessage(err, "Could not verify your email."),
        );
      });
  }, [token, email]);

  async function handleResend() {
    try {
      await resendVerificationApi(email);
      setResent(true);
    } catch {
      setResent(true); // generic by design
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: "#f1f5f9" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {state === "verifying" && "Verifying your email…"}
          {state === "ok" && "Email verified"}
          {state === "error" && "Verification failed"}
          {state === "invalid" && "Invalid link"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {state === "verifying" && "One moment please."}
          {state === "ok" && message}
          {state === "error" && message}
          {state === "invalid" &&
            "This link is missing required information."}
        </p>

        {state === "ok" && (
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-semibold text-[#6c739c] hover:underline"
          >
            Continue to sign in
          </Link>
        )}

        {(state === "error" || state === "invalid") && email && (
          <button
            onClick={handleResend}
            disabled={resent}
            className="mt-6 inline-block text-sm font-semibold text-[#6c739c] hover:underline disabled:opacity-60"
          >
            {resent
              ? "If the account needs it, a new link was sent."
              : "Send a new verification link"}
          </button>
        )}

        <div className="mt-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center"
          style={{ backgroundColor: "#f1f5f9" }}
        />
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}

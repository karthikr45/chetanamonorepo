"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, FormLabel, InputBordered } from "@/components/ui";
import { forgotPasswordApi } from "@/features/auth/api/auth.api";
import { getApiErrorMessage } from "@/lib/api-client";
import { validateUsername } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateUsername(email);
    if (!v.valid) {
      setFieldError(v.message);
      return;
    }
    setFieldError(undefined);
    setServerError(undefined);
    setIsLoading(true);
    try {
      await forgotPasswordApi(email.trim());
      setSent(true);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Could not send the reset link."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: "#f1f5f9" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        {sent ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              If an account exists for{" "}
              <span className="font-semibold">{email.trim()}</span>, we&apos;ve
              sent a password reset link. It expires in 30 minutes.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm font-semibold text-[#6c739c] hover:underline"
            >
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter your account email and we&apos;ll send you a link to reset
              your password.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <FormLabel htmlFor="fp-email" required>
                  Email
                </FormLabel>
                <InputBordered
                  id="fp-email"
                  type="email"
                  placeholder="you@svbk.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(undefined);
                  }}
                  autoComplete="username email"
                  error={fieldError}
                  fullWidth
                />
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg border px-3 py-2.5 text-sm"
                  style={{
                    backgroundColor: "#fef2f2",
                    borderColor: "#fee2e2",
                    color: "#b91c1c",
                  }}
                >
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
              >
                Send reset link
              </Button>
            </form>

            <Link
              href="/"
              className="mt-5 inline-block text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

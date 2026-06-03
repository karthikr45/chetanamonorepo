"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormLabel, PasswordInput } from "@/components/ui";
import { resetPasswordApi } from "@/features/auth/api/auth.api";
import { getApiErrorMessage } from "@/lib/api-client";
import { validatePassword } from "@/lib/validation";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const linkBroken = !token || !email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const p = validatePassword(password);
    if (!p.valid) next.password = p.message;
    if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setServerError(undefined);
    setIsLoading(true);
    try {
      await resetPasswordApi({ email, token, newPassword: password });
      setDone(true);
      setTimeout(() => router.replace("/"), 2500);
    } catch (err) {
      setServerError(
        getApiErrorMessage(err, "Could not reset your password."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (linkBroken) {
    return (
      <Card>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Invalid reset link
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This link is missing required information. Please request a new
          password reset.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-semibold text-[#6c739c] hover:underline"
        >
          Request a new link
        </Link>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Password updated
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your password has been reset. Redirecting you to sign in…
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-[#6c739c] hover:underline"
        >
          Go to sign in now
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Set a new password
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Resetting the password for{" "}
        <span className="font-semibold">{email}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <FormLabel htmlFor="rp-password" required>
            New password
          </FormLabel>
          <PasswordInput
            id="rp-password"
            placeholder="At least 8 characters, 1 letter & 1 number"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password)
                setErrors((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="new-password"
            error={errors.password}
            fullWidth
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FormLabel htmlFor="rp-confirm" required>
            Confirm password
          </FormLabel>
          <PasswordInput
            id="rp-confirm"
            placeholder="Re-enter your new password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm)
                setErrors((p) => ({ ...p, confirm: undefined }));
            }}
            autoComplete="new-password"
            error={errors.confirm}
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
          Reset password
        </Button>
      </form>

      <Link
        href="/"
        className="mt-5 inline-block text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← Back to sign in
      </Link>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: "#f1f5f9" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        {children}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center"
          style={{ backgroundColor: "#f1f5f9" }}
        />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

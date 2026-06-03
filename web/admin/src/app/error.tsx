"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {}, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--app-warning-bg)" }}>
          <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-warning)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          Something went wrong
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--app-text-secondary)" }}>
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs" style={{ color: "var(--app-text-secondary)" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--app-brand)" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Try Again
          </button>
          <a
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-xl border px-6 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)]"
            style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

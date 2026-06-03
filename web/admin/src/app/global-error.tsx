"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {}, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#fff" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div
              style={{
                margin: "0 auto 1rem",
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="32" height="32" fill="none" stroke="#dc2626" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#18181b", margin: "0 0 0.5rem" }}>
              Critical Error
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#71717a", margin: "0 0 2rem" }}>
              A critical error occurred and the application could not recover. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace", margin: "0 0 1.5rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  height: 40,
                  padding: "0 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#fff",
                  backgroundColor: "#6c739c",
                  border: "none",
                  borderRadius: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 40,
                  padding: "0 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#71717a",
                  border: "1px solid #e4e4e7",
                  borderRadius: "0.75rem",
                  textDecoration: "none",
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

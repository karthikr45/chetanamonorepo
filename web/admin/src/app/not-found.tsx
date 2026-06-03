import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="text-center">
        <p className="text-8xl font-extrabold tracking-tight" style={{ color: "var(--app-brand)" }}>
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          Page not found
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--app-text-secondary)" }}>
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or doesn&apos;t exist.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--app-brand)" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
            </svg>
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border px-6 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)]"
            style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

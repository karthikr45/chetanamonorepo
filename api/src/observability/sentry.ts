/**
 * Thin wrapper around @sentry/node. No-op when SENTRY_DSN isn't set,
 * so dev environments don't need a DSN configured.
 *
 * Init must run BEFORE NestFactory.create — call `initSentry()` from
 * the top of main.ts. Once init has run, `captureError(err, tags)`
 * forwards to Sentry; if init wasn't run (or was disabled), it's a
 * silent no-op. That way callers don't need to gate every call site.
 */

let initialised = false;
// Loaded lazily so that environments without @sentry/node installed
// (and without SENTRY_DSN set) still boot.
let SentrySdk: typeof import('@sentry/node') | null = null;

export interface SentryInitOptions {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

export async function initSentry(
  opts: SentryInitOptions | null,
): Promise<void> {
  if (!opts?.dsn) return;
  try {
    SentrySdk = await import('@sentry/node');
    SentrySdk.init({
      dsn: opts.dsn,
      environment: opts.environment,
      release: opts.release,
      tracesSampleRate: opts.tracesSampleRate ?? 0,
    });
    initialised = true;
  } catch (err) {
    // Don't crash boot on a Sentry init failure — log to stderr and move on.
    // eslint-disable-next-line no-console
    console.error('Sentry init failed:', err);
  }
}

/**
 * Forward an exception to Sentry with optional tags. Safe to call from
 * anywhere — silently no-ops when Sentry isn't initialised.
 */
export function captureError(
  err: unknown,
  tags?: Record<string, string | number | null | undefined>,
): void {
  if (!initialised || !SentrySdk) return;
  try {
    SentrySdk.captureException(err, (scope) => {
      if (tags) {
        for (const [k, v] of Object.entries(tags)) {
          if (v == null) continue;
          scope.setTag(k, String(v));
        }
      }
      return scope;
    });
  } catch {
    // never let an observability path break the request path
  }
}

export function isSentryEnabled(): boolean {
  return initialised;
}

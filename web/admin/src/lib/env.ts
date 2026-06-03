/**
 * Environment helpers. Next.js exposes NEXT_PUBLIC_* to the client.
 */

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

function getEnv(key: string): string {
  if (typeof process === "undefined") return "";
  const value = process.env[key];
  return value != null ? String(value).trim() : "";
}

export const env = {
  /** API base URL for all requests. Defaults to https://svbkapi.aautipay.com */
  apiBaseUrl: getEnv("NEXT_PUBLIC_API_BASE_URL") || DEFAULT_API_BASE_URL,
  isProduction: process.env.NODE_ENV === "production",
} as const;

export function getApiBaseUrl(): string {
  const base = env.apiBaseUrl?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Add it to .env (see .env.example)."
    );
  }
  return base;
}

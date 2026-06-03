"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { isAuthenticated } from "./auth";

type BrandingPayload = {
  logoUrl: string | null;
  tenantId: string | null;
};

function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Parent-side branding hook. Fires a fresh fetch on mount when the
 * parent is signed in. No module-level caching — each consumer's
 * lifecycle drives its own load so logout / re-login can't surface
 * stale data.
 */
export function useTenantBranding(): { logoUrl: string; isCustom: boolean } {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    api
      .get("/tenant-configs/me/branding")
      .then(({ data }) => {
        if (cancelled) return;
        const payload = unwrap<BrandingPayload>(data);
        setLogoUrl(payload?.logoUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    logoUrl: logoUrl || "/svbk_logo.webp",
    isCustom: Boolean(logoUrl),
  };
}

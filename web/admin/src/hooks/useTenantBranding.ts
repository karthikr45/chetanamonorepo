"use client";

import { useAuth } from "@/features/auth";

/**
 * Tenant logo, sourced from the AuthContext-managed fetch that fires
 * on every token change. Falls back to the generic SVBK logo when the
 * tenant has no logo configured or the user is not signed in.
 */
export function useTenantBranding(): { logoUrl: string; isCustom: boolean } {
  const { branding } = useAuth();
  const custom = branding?.logoUrl ?? null;
  return {
    logoUrl: custom || "/svbk_logo.webp",
    isCustom: Boolean(custom),
  };
}

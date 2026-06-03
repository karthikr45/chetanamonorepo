"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth";

/**
 * AppShell is mostly a pass-through router gate. The dashboard chrome
 * (Sidebar + Navbar) lives in the (dashboard) route-group layout so that
 * the sidebar can be a flex sibling of the page content (proper SaaS
 * layout) instead of overlaying it.
 *
 * Tenants (super-admin) and the auth/login pages provide their own shells.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isLoginPage = pathname === "/";
  const isPayNowPage = pathname === "/pay-now";
  const isTenantsPage = pathname.includes("/tenants");

  // Pay-now public flow has no chrome until the user is authenticated.
  if (isLoginPage || isTenantsPage || (isPayNowPage && !isAuthenticated)) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

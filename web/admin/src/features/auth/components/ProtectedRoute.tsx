"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/context";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed to access this route. If omitted, any authenticated user is allowed. */
  allowedRoles?: string[];
}

/** Redirect destinations when a role lands on the wrong route group. */
const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard",
  fin_admin: "/dashboard",
  ops_admin: "/dashboard",
  super_admin: "/super-admin",
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/?redirect=${encodeURIComponent(pathname ?? "/")}`);
      return;
    }
    if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
      // Redirect to the correct home for this role, or "/" if unknown
      router.replace(ROLE_HOME[user.role] ?? "/");
    }
  }, [isAuthenticated, user, router, pathname, allowedRoles]);

  if (!isAuthenticated) return null;
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}

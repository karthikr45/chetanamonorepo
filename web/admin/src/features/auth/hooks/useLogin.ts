"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api-client";
import type { LoginCredentials, TenantSelectionData } from "@/features/auth/types";
import {
  login,
  selectTenant as selectTenantSvc,
  getStoredToken,
  getStoredUser,
} from "@/features/auth/services";
import { useAuth } from "@/features/auth/context";

/**
 * Handles a two-step login:
 * 1. handleLogin(credentials) → if the user belongs to only one tenant,
 *    navigates to the dashboard. If multiple, exposes a tenant picker via
 *    `selection`; caller renders it and calls `chooseTenant(adminId)`.
 */
export function useLogin() {
  const router = useRouter();
  const { setToken, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TenantSelectionData | null>(null);

  const goToHome = () => {
    setToken(getStoredToken());
    const user = getStoredUser();
    setUser(user);
    // super-admins land on the platform dashboard; everyone else on
    // the tenant dashboard.
    router.push(user?.role === "super_admin" ? "/super-admin" : "/dashboard");
  };

  const handleLogin = async (credentials: LoginCredentials) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await login(credentials);
      if (result.kind === "selection") {
        setSelection(result.data);
        return;
      }
      goToHome();
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const chooseTenant = async (adminId: string) => {
    if (!selection) return;
    setError(null);
    setIsLoading(true);
    try {
      await selectTenantSvc({
        selectionToken: selection.selectionToken,
        adminId,
      });
      setSelection(null);
      goToHome();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not switch tenant."));
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSelection = () => {
    setSelection(null);
    setError(null);
  };

  return {
    login: handleLogin,
    chooseTenant,
    cancelSelection,
    selection,
    isLoading,
    error,
  };
}

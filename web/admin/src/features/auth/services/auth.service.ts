/**
 * Auth service – business logic. Calls api layer only; handles token storage.
 * Stores accessToken and refreshToken. When a 401 occurs, api-client calls
 * refreshAccessToken() via the registered callback, retries the request, and
 * dispatches 'auth:logout' if the refresh itself fails.
 *
 * Multi-tenant login: the backend may return either
 *   - { response: { accessToken, refreshToken, ... } }  → log straight in
 *   - { requireTenantSelection: true, response: { selectionToken, tenants } }
 *       → caller renders a tenant picker, then calls selectTenant()
 */

import { setAuthTokenGetter, setRefreshTokenCallback } from "@/lib/api-client";
import { authConfig } from "@/features/auth/config";
import type {
  AuthUser,
  LoginApiData,
  LoginCredentials,
  LoginResponse,
  TenantSelectionData,
} from "@/features/auth/types";
import {
  verifyLoginApi,
  refreshTokenApi,
  selectTenantApi,
} from "@/features/auth/api/auth.api";
import {
  STORAGE_KEY,
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "@/storage";

// ─── Token helpers ────────────────────────────────────────────────────────────

function readToken(): string | null {
  return getStorageItem<string>(STORAGE_KEY.authToken);
}

function writeToken(token: string): void {
  setStorageItem<string>(STORAGE_KEY.authToken, token);
}

function removeToken(): void {
  removeStorageItem(STORAGE_KEY.authToken);
}

function readRefreshToken(): string | null {
  return getStorageItem<string>(STORAGE_KEY.refreshToken);
}

function writeRefreshToken(token: string): void {
  setStorageItem<string>(STORAGE_KEY.refreshToken, token);
}

function removeRefreshToken(): void {
  removeStorageItem(STORAGE_KEY.refreshToken);
}

// ─── API-client wiring ────────────────────────────────────────────────────────

if (authConfig.useTokenAuth) {
  setAuthTokenGetter(readToken);
}

if (authConfig.useJwtRefresh) {
  setRefreshTokenCallback(refreshAccessToken);
}

// ─── JWT expiry helper ────────────────────────────────────────────────────────

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ─── Public token API ─────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return readToken();
}

export function setStoredToken(token: string | null): void {
  if (token) writeToken(token);
  else removeToken();
}

export function clearStoredToken(): void {
  removeToken();
}

export function getStoredRefreshToken(): string | null {
  return readRefreshToken();
}

export function clearStoredRefreshToken(): void {
  removeRefreshToken();
}

// ─── Public user API ──────────────────────────────────────────────────────────

export function getStoredUser(): AuthUser | null {
  return getStorageItem<AuthUser>(STORAGE_KEY.userDetails);
}

export function setStoredUser(user: AuthUser | null): void {
  if (user) setStorageItem<AuthUser>(STORAGE_KEY.userDetails, user);
  else removeStorageItem(STORAGE_KEY.userDetails);
}

export function clearStoredUser(): void {
  removeStorageItem(STORAGE_KEY.userDetails);
}

// ─── Login / select-tenant / logout ──────────────────────────────────────────

/**
 * Discriminated union to keep callers honest about the multi-tenant case.
 *  - kind: "tokens"     → user is logged in, tokens stored.
 *  - kind: "selection"  → caller must render a tenant picker and then call
 *                         selectTenant() with the user's choice.
 */
export type LoginOutcome =
  | { kind: "tokens"; user: AuthUser }
  | { kind: "selection"; data: TenantSelectionData };

function isSelection(
  payload: LoginApiData | TenantSelectionData,
): payload is TenantSelectionData {
  return (
    (payload as TenantSelectionData)?.selectionToken !== undefined &&
    Array.isArray((payload as TenantSelectionData).tenants)
  );
}

/** Unwrap whichever wrapper shape the backend returns. */
function unwrap(res: LoginResponse): {
  requireTenantSelection: boolean;
  payload: LoginApiData | TenantSelectionData;
} {
  if (res.response) {
    return {
      requireTenantSelection: !!res.requireTenantSelection,
      payload: res.response,
    };
  }
  // Legacy { data: { response: {...} } }
  return {
    requireTenantSelection: false,
    payload: (res.data?.response as LoginApiData) ?? ({} as LoginApiData),
  };
}

function persistTokens(payload: LoginApiData): AuthUser {
  const {
    accessToken,
    refreshToken,
    email,
    role,
    tenantId,
    tenantName,
    branch,
    id,
  } = payload;

  if (authConfig.useTokenAuth && accessToken) writeToken(accessToken);
  if (authConfig.useJwtRefresh && refreshToken) writeRefreshToken(refreshToken);

  const user: AuthUser = {
    email,
    role,
    tenantId: tenantId ?? null,
    tenantName: tenantName ?? null,
    branch: branch ?? null,
    id,
  };
  setStoredUser(user);
  return user;
}

export async function login(
  credentials: LoginCredentials,
): Promise<LoginOutcome> {
  const res = await verifyLoginApi({
    email: credentials.email.trim(),
    password: credentials.password,
  });
  const { requireTenantSelection, payload } = unwrap(res);
  if (requireTenantSelection || isSelection(payload)) {
    return { kind: "selection", data: payload as TenantSelectionData };
  }
  return { kind: "tokens", user: persistTokens(payload as LoginApiData) };
}

export async function selectTenant(args: {
  selectionToken: string;
  adminId: string;
}): Promise<AuthUser> {
  const res = await selectTenantApi(args);
  const { payload } = unwrap(res);
  return persistTokens(payload as LoginApiData);
}

export async function logout(): Promise<void> {
  removeToken();
  removeRefreshToken();
  removeStorageItem(STORAGE_KEY.userDetails);
}

// ─── Token refresh (called by api-client 401 interceptor) ────────────────────

export async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = readRefreshToken();
  if (!storedRefresh) {
    dispatchLogout();
    return null;
  }

  try {
    const res = await refreshTokenApi(storedRefresh);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = res as any;
    const accessToken: string | undefined =
      raw?.response?.accessToken ??
      raw?.data?.response?.accessToken ??
      raw?.data?.accessToken ??
      raw?.accessToken;
    const refreshToken: string | undefined =
      raw?.response?.refreshToken ??
      raw?.data?.response?.refreshToken ??
      raw?.data?.refreshToken ??
      raw?.refreshToken;

    if (accessToken) {
      writeToken(accessToken);
      if (refreshToken) writeRefreshToken(refreshToken);
      return accessToken;
    }
    dispatchLogout();
    return null;
  } catch {
    removeToken();
    removeRefreshToken();
    removeStorageItem(STORAGE_KEY.userDetails);
    dispatchLogout();
    return null;
  }
}

function dispatchLogout(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:logout"));
  }
}

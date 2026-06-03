const TOKENS_KEY = "svbk_parent_tokens";
const PARENT_KEY = "svbk_parent_profile";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ParentProfile {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

export function getTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function getParent(): ParentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PARENT_KEY);
    return raw ? (JSON.parse(raw) as ParentProfile) : null;
  } catch {
    return null;
  }
}

export function setParent(parent: ParentProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARENT_KEY, JSON.stringify(parent));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKENS_KEY);
  localStorage.removeItem(PARENT_KEY);
}

export function isAuthenticated(): boolean {
  return getTokens()?.accessToken != null;
}

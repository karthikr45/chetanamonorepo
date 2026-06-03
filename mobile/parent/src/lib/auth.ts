import * as SecureStore from "expo-secure-store";

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

export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
}

export async function getParent(): Promise<ParentProfile | null> {
  try {
    const raw = await SecureStore.getItemAsync(PARENT_KEY);
    return raw ? (JSON.parse(raw) as ParentProfile) : null;
  } catch {
    return null;
  }
}

export async function setParent(p: ParentProfile): Promise<void> {
  await SecureStore.setItemAsync(PARENT_KEY, JSON.stringify(p));
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
  await SecureStore.deleteItemAsync(PARENT_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getTokens())?.accessToken != null;
}

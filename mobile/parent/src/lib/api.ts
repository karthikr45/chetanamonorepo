import axios, { AxiosError, type AxiosInstance } from "axios";
import Constants from "expo-constants";
import { clearAuth, getTokens, setTokens } from "./auth";

const baseURL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:3001/api";

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const tokens = await getTokens();
  if (tokens?.accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return null;
  try {
    const { data } = await axios.post(`${baseURL}/parent/auth/refresh`, {
      refreshToken: tokens.refreshToken,
    });
    const accessToken: string = data.accessToken ?? data.data?.accessToken;
    const refreshToken: string = data.refreshToken ?? data.data?.refreshToken;
    if (!accessToken || !refreshToken) return null;
    await setTokens({ accessToken, refreshToken });
    return accessToken;
  } catch {
    await clearAuth();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/parent/auth/")
    ) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization =
          `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

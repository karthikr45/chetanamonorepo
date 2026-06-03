/**
 * Global API client (Axios). Used only by feature api layers.
 * Request interceptor: attach auth token when setAuthTokenGetter is used.
 * Response interceptor: normalize errors + 401 refresh-token retry.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { env } from "./env";

export interface ApiError {
  message: string;
  statusCode: number;
}

/** Extract user-facing message from thrown API error. Use in hooks for consistent UX. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as ApiError).message === "string") {
    return (error as ApiError).message;
  }
  return fallback;
}

/** Set by auth service when useTokenAuth is true. */
let getAuthToken: (() => string | null) | null = null;

export function setAuthTokenGetter(fn: () => string | null): void {
  getAuthToken = fn;
}

/** Set by auth service when useJwtRefresh is true. Returns new access token or null on failure. */
let refreshTokenCallback: (() => Promise<string | null>) | null = null;

export function setRefreshTokenCallback(fn: () => Promise<string | null>): void {
  refreshTokenCallback = fn;
}

const baseURL = env.apiBaseUrl.replace(/\/$/, "") || env.apiBaseUrl;

const client: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers as Record<string, unknown> | undefined;
    if (headers) {
      delete headers["Content-Type"];
      delete headers["content-type"];
    }
  }

  // Never attach an (possibly expired) access token to the refresh call —
  // backends typically reject the request if they see an invalid Bearer token
  // even when the refresh token body is valid.
  const isRefreshEndpoint = config.url?.includes("/auth/refresh");
  if (!isRefreshEndpoint) {
    const token = getAuthToken?.();
    if (token && token !== "session") {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? 500;
    const data = error.response?.data;
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : typeof data?.errorMessage === "string"
            ? data.errorMessage
            : error.message || "Request failed";
    return { message, statusCode };
  }
  return {
    message: error instanceof Error ? error.message : "Request failed",
    statusCode: 500,
  };
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function processRefreshQueue(token: string | null): void {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequest;

    // Skip refresh logic for the refresh endpoint itself to prevent infinite loops
    const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh");

    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshEndpoint &&
      refreshTokenCallback
    ) {
      if (isRefreshing) {
        // Queue concurrent 401s to retry once the in-flight refresh resolves
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(client(originalRequest));
            } else {
              reject(toApiError(error));
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshTokenCallback();
        isRefreshing = false;
        processRefreshQueue(newToken);
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }
      } catch {
        isRefreshing = false;
        processRefreshQueue(null);
        // refreshTokenCallback already cleared storage and dispatched auth:logout
      }
    }

    return Promise.reject(toApiError(error));
  }
);

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return client.get<T>(url, config).then((res) => res.data);
}

export function post<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  return client.post<T>(url, data, config).then((res) => res.data);
}

export function put<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  return client.put<T>(url, data, config).then((res) => res.data);
}

export function patch<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<T> {
  return client.patch<T>(url, data, config).then((res) => res.data);
}

export function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return client.delete<T>(url, config).then((res) => res.data);
}

export { client as apiClient };

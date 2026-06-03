/**
 * Re-exports the global API client from lib.
 * All HTTP calls should use @/lib/api-client; this exists for backward compatibility.
 * @deprecated Prefer importing from @/lib/api-client in new code.
 */

export {
  get,
  post,
  put,
  patch,
  del,
  apiClient as httpClient,
  setAuthTokenGetter,
  type ApiError,
} from "@/lib/api-client";

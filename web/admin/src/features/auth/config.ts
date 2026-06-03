/**
 * Auth feature flags. Toggle when backend supports JWT.
 *
 * - useTokenAuth: if true, store accessToken and attach Bearer to API requests.
 * - useJwtRefresh: set to true when you add refresh-token logic; then implement
 *   refresh in auth.service and 401 interceptor in api-client.
 */

export const authConfig = {
  /** Use stored token and send Authorization header. Set false for session-only auth. */
  useTokenAuth: true,
  /** JWT refresh: set true when backend has /refresh and you add refresh logic. */
  useJwtRefresh: true,
} as const;

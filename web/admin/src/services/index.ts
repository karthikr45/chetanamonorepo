/**
 * Services – feature-wise API layer (Axios).
 *
 *   http/       Shared client (get, post, put, patch, del)
 *   constants/  Endpoints by feature (auth, user, …)
 *   auth/       Auth feature (verifyLogin, …)
 *   user/       User feature (getProfile, …)
 *
 * Add a new feature: create <feature>/<feature>.service.ts + index, add endpoints in constants.
 */

export { get, post, put, patch, del, httpClient, type ApiError } from "./http";
export { API_ENDPOINTS, type ApiEndpoints } from "./constants";
export {
  verifyLogin,
  type VerifyLoginRequest,
} from "./auth";

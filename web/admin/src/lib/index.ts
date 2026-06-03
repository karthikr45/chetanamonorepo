/**
 * Global infrastructure. Single entry for api-client, env, utils, validation.
 */

export {
  get,
  post,
  put,
  patch,
  del,
  apiClient,
  setAuthTokenGetter,
  getApiErrorMessage,
  type ApiError,
} from "./api-client";
export { env, getApiBaseUrl } from "./env";
export { cn } from "./utils";
export {
  validateUsername,
  validatePassword,
  validationMessages,
  USERNAME_REGEX,
  PASSWORD_REGEX,
  type ValidationResult,
} from "./validation";

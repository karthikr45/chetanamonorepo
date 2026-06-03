/**
 * User feature – profile, update. Uncomment when backend is ready.
 */

import { get, patch, type ApiError } from "../http";
import { API_ENDPOINTS } from "../constants";

// export interface UserProfile {
//   id: string;
//   email: string;
//   name?: string;
// }

// export async function getProfile(): Promise<UserProfile> {
//   return get(API_ENDPOINTS.user.profile);
// }

// export async function updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
//   return patch(API_ENDPOINTS.user.update, data);
// }

export type { ApiError };

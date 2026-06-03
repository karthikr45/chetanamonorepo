/**
 * Auth API – re-exports from features/auth for backward compatibility.
 * New code should use @/features/auth (hooks/services/api).
 * @deprecated Prefer features/auth api layer and useLogin / auth.service.
 */

import type { LoginCredentials, LoginResponse } from "@/features/auth";
import { verifyLoginApi } from "@/features/auth/api/auth.api";

export interface VerifyLoginRequest {
  email: string;
  password: string;
}

/** POST /verifyLogin – delegates to features/auth. */
export async function verifyLogin(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const body: VerifyLoginRequest = {
    email: credentials.email.trim(),
    password: credentials.password,
  };
  return verifyLoginApi(body);
}

export type { ApiError } from "@/lib/api-client";

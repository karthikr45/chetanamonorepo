/**
 * Auth feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { post } from "@/lib/api-client";
import type { LoginResponse } from "@/features/auth/types";

const AUTH_ENDPOINTS = {
  verifyLogin: "/auth/signin",
  selectTenant: "/auth/select-tenant",
  logout: "/logout",
  refreshToken: "/auth/refresh",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/resend-verification",
} as const;

export async function verifyEmailApi(body: {
  email: string;
  token: string;
}): Promise<{ message: string }> {
  return post<{ message: string }, typeof body>(
    AUTH_ENDPOINTS.verifyEmail,
    body,
  );
}

export async function resendVerificationApi(
  email: string,
): Promise<{ message: string }> {
  return post<{ message: string }, { email: string }>(
    AUTH_ENDPOINTS.resendVerification,
    { email },
  );
}

export async function forgotPasswordApi(
  email: string,
): Promise<{ message: string }> {
  return post<{ message: string }, { email: string }>(
    AUTH_ENDPOINTS.forgotPassword,
    { email },
  );
}

export async function resetPasswordApi(body: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return post<{ message: string }, typeof body>(
    AUTH_ENDPOINTS.resetPassword,
    body,
  );
}

export async function verifyLoginApi(
  body: { email: string; password: string },
): Promise<LoginResponse> {
  return post<LoginResponse, typeof body>(AUTH_ENDPOINTS.verifyLogin, body);
}

export async function selectTenantApi(body: {
  selectionToken: string;
  adminId: string;
}): Promise<LoginResponse> {
  return post<LoginResponse, typeof body>(AUTH_ENDPOINTS.selectTenant, body);
}

export async function refreshTokenApi(refreshToken: string): Promise<LoginResponse> {
  return post<LoginResponse, { refreshToken: string }>(
    AUTH_ENDPOINTS.refreshToken,
    { refreshToken },
  );
}

/**
 * Fees feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { get } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";
import type { DashboardStatsApiResponse } from "@/features/fees/types";

export async function getDashboardStatsApi(): Promise<DashboardStatsApiResponse> {
  return get<DashboardStatsApiResponse>(API_ENDPOINTS.fees.getDashboardStats);
}

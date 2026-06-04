import { API_ENDPOINTS } from "@/services/constants/endpoints";
import { get, patch } from "@/lib/api-client";
import type { NotificationItem } from "../types";

/**
 * Notifications API. The backend scopes every response to the caller's
 * tenant, user id and ROLE (from the JWT), so the client never passes
 * role/branch — it just asks for "my notifications".
 */

/** Notifications visible to the current user (role-scoped server-side). */
export async function listNotificationsApi(): Promise<NotificationItem[]> {
  const data = await get<NotificationItem[] | { notifications?: NotificationItem[] }>(
    API_ENDPOINTS.notifications.list,
  );
  if (Array.isArray(data)) return data;
  return data?.notifications ?? [];
}

/** Unread count for the badge. */
export async function getUnreadCountApi(): Promise<number> {
  const data = await get<{ count: number }>(API_ENDPOINTS.notifications.unreadCount);
  return Number(data?.count ?? 0);
}

/** Mark a single notification as read. */
export async function markNotificationReadApi(id: string): Promise<void> {
  await patch<void>(`${API_ENDPOINTS.notifications.markRead}/${id}/read`, {});
}

/** Mark every visible notification as read. */
export async function markAllNotificationsReadApi(): Promise<{ updated: number }> {
  return patch<{ updated: number }>(API_ENDPOINTS.notifications.markAllRead, {});
}

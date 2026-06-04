"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth";
import { getStoredToken } from "@/features/auth/services";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from "../api/notification.api";
import { acquireNotificationsSocket, releaseNotificationsSocket } from "../socket";
import type { NotificationItem } from "../types";

/**
 * Loads the current user's notifications (role-scoped by the API) and keeps
 * them fresh by polling. Exposes the unread count and read mutations with
 * optimistic updates. Polling pauses while the tab is hidden.
 */
export function useNotifications(pollMs = 45_000) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await listNotificationsApi();
      if (mounted.current) {
        setItems(list);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(getApiErrorMessage(e, "Could not load notifications"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return () => {
        mounted.current = false;
      };
    }
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isAuthenticated, refresh, pollMs]);

  // Realtime push: prepend new notifications the instant they're sent, so the
  // bell updates without waiting for the next poll. Polling remains a fallback.
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getStoredToken();
    if (!token) return;
    const socket = acquireNotificationsSocket(token);
    const onNew = (n: NotificationItem) => {
      if (!mounted.current) return;
      setItems((prev) => (prev.some((i) => i.id === n.id) ? prev : [n, ...prev]));
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
      releaseNotificationsSocket();
    };
  }, [isAuthenticated]);

  const unreadCount = items.reduce((n, i) => (i.isRead ? n : n + 1), 0);

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id && !i.isRead ? { ...i, isRead: true } : i)),
      );
      try {
        await markNotificationReadApi(id);
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((i) => (i.isRead ? i : { ...i, isRead: true })));
    try {
      await markAllNotificationsReadApi();
    } catch {
      void refresh();
    }
  }, [refresh]);

  return { items, unreadCount, loading, error, refresh, markRead, markAllRead };
}

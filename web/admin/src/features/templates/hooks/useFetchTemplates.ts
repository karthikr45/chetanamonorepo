"use client";

import { useState, useCallback, useEffect } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Template } from "@/features/templates/types";
import { getTemplates } from "@/features/templates/services/templates.service";
import { getStorageItem, STORAGE_KEY } from "@/storage";
import type { AuthUser } from "@/features/auth/types";

function getAdminId(): string {
  const user = getStorageItem<AuthUser>(STORAGE_KEY.userDetails);
  return user?.id ?? "";
}

export function useFetchTemplates() {
  const [data, setData] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const adminId = getAdminId();
    setLoading(true);
    setError(null);
    try {
      const rows = await getTemplates(adminId);
      setData(rows);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load templates"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useFetchApprovedTemplates() {
  const { data, loading, error, refetch } = useFetchTemplates();
  const approved = data.filter((t) => t.status === "approved");
  return { data: approved, loading, error, refetch };
}

"use client";

import { useEffect, useState } from "react";
import {
  listSystemMetadataApi,
  type SystemMetadataRow,
} from "@/features/system-metadata/api/system-metadata.api";

export interface MetadataOption {
  value: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

const cache = new Map<string, MetadataOption[]>();
const inFlight = new Map<string, Promise<MetadataOption[]>>();

function unwrap(res: unknown): SystemMetadataRow[] {
  if (Array.isArray(res)) return res as SystemMetadataRow[];
  const data = (res as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as SystemMetadataRow[]) : [];
}

function toOptions(rows: SystemMetadataRow[]): MetadataOption[] {
  return rows
    .filter((r) => r && typeof r.value === "string" && r.value)
    .sort(
      (a, b) =>
        Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) ||
        a.value.localeCompare(b.value),
    )
    .map((r) => ({
      value: String(r.value),
      label: String(r.label ?? r.value),
      displayOrder: Number(r.displayOrder ?? 0),
      isActive: r.isActive !== false,
    }));
}

async function fetchOnce(
  type: string,
  activeOnly: boolean,
): Promise<MetadataOption[]> {
  const key = `${type}|${activeOnly ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const inflight = inFlight.get(key);
  if (inflight) return inflight;
  const p = listSystemMetadataApi({ type, activeOnly })
    .then((res) => {
      const opts = toOptions(unwrap(res));
      cache.set(key, opts);
      return opts;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
}

/**
 * Loads system_metadata options for a given type. Returns a stable hook
 * tuple with options, loading flag, error string, and a refresh fn.
 * Results are memoised across calls so multiple components fetching the
 * same type only hit the API once per page-load.
 *
 * `fallback` lets callers render something sensible while the request is
 * in flight, or if the API returns nothing (e.g. fresh DB before seeding).
 */
export function useMetadata(
  type: string,
  opts: { activeOnly?: boolean; fallback?: MetadataOption[] } = {},
) {
  const activeOnly = opts.activeOnly ?? true;
  const fallback = opts.fallback ?? [];
  const [options, setOptions] = useState<MetadataOption[]>(
    cache.get(`${type}|${activeOnly ? 1 : 0}`) ?? fallback,
  );
  const [loading, setLoading] = useState(!cache.has(`${type}|${activeOnly ? 1 : 0}`));
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchOnce(type, activeOnly)
      .then((opts2) => {
        setOptions(opts2.length > 0 ? opts2 : fallback);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load metadata");
        setOptions((prev) => (prev.length > 0 ? prev : fallback));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, activeOnly]);

  const refresh = () => {
    cache.delete(`${type}|${activeOnly ? 1 : 0}`);
    load();
  };

  return { options, loading, error, refresh };
}

"use client";

import { useEffect, useMemo } from "react";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

/** Indian academic year for a date: Apr–Mar (e.g. May 2026 → 2026-2027). */
export function currentAcademicYear(d = new Date()): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Normalises "2025-26" / "2025 - 2026" → "2025-2026" for matching. */
function normalize(v: string): string {
  const m = v.match(/(\d{4})\D+(\d{2,4})/);
  if (!m) return v;
  const end = m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2];
  return `${m[1]}-${end}`;
}

/**
 * One academic-year picker used across every screen so the control and
 * its default behaviour are uniform. Loads options from system_metadata
 * (`academic_year`); defaults to the **current** academic year when the
 * value is empty. Falls back to a text input only if metadata is empty
 * so a fresh DB still works.
 */
export function AcademicYearSelect({
  value,
  onChange,
  includeAll = false,
  allLabel = "All years",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}) {
  const { options } = useMetadata("academic_year");

  const cls =
    className ||
    "h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20";

  const resolvedDefault = useMemo(() => {
    if (!options.length) return "";
    const cur = normalize(currentAcademicYear());
    const hit = options.find((o) => normalize(o.value) === cur);
    return hit ? hit.value : options[options.length - 1].value;
  }, [options]);

  // Apply the current-year default once options arrive and nothing is set.
  useEffect(() => {
    if (!value && !includeAll && resolvedDefault) onChange(resolvedDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedDefault]);

  if (options.length === 0) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={includeAll ? "All years" : currentAcademicYear()}
        className={cls}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cls}
    >
      {includeAll && <option value="">{allLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

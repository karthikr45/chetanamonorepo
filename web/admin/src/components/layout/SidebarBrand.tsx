"use client";

import Image from "next/image";
import Link from "next/link";
import { useTenantBranding } from "@/hooks/useTenantBranding";

// Use a short brand label in the sidebar (school full name lives in the
// header / page contexts). This keeps the rail clean and consistent with
// premium SaaS patterns (Linear/Vercel: short product name in the rail).
const brandShort = "SVBK";
const brandSub = "School Console";

export function SidebarBrand() {
  const { logoUrl, isCustom } = useTenantBranding();
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-3 overflow-hidden rounded-lg px-1.5 py-1 transition-colors duration-200 hover:bg-[var(--app-nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/40"
    >
      <span
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/5 shadow-sm"
        style={{ backgroundColor: "var(--app-card-bg)" }}
      >
        <Image
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          className="object-contain p-0.5"
          sizes="36px"
          priority
          unoptimized={isCustom}
        />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span
          className="block truncate text-[15px] font-bold tracking-tight"
          style={{ color: "var(--app-text-primary)" }}
        >
          {brandShort}
        </span>
        <span
          className="block truncate text-[11px] font-medium"
          style={{ color: "var(--app-text-secondary)" }}
        >
          {brandSub}
        </span>
      </span>
    </Link>
  );
}

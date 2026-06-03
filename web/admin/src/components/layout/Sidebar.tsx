"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "@/context/ui-context";
import { useAuth } from "@/features/auth";
import { useTenantBranding } from "@/hooks/useTenantBranding";

type NavItem =
  | { type: "item"; href: string; label: string; icon: string }
  | {
      type: "group";
      key: string;
      label: string;
      icon: string;
      children: { href: string; label: string }[];
    };

const tenantAdminNav: NavItem[] = [
  { type: "item", href: "/dashboard", label: "Dashboard", icon: "grid" },
  { type: "item", href: "/students", label: "Students", icon: "students" },
  {
    type: "item",
    href: "/transfer-certificate",
    label: "Transfer Certificate",
    icon: "certificate",
  },
  { type: "item", href: "/payments", label: "Payment Details", icon: "payment" },
  { type: "item", href: "/pay-now", label: "Pay Now", icon: "paynow" },
  { type: "item", href: "/approvals", label: "Approvals", icon: "approve" },
  { type: "item", href: "/chat", label: "Chat", icon: "chat" },
  { type: "item", href: "/social", label: "Social Feed", icon: "feed" },
  {
    type: "item",
    href: "/announcements",
    label: "Communications",
    icon: "megaphone",
  },
  { type: "item", href: "/media", label: "Media", icon: "media" },
  {
    type: "group",
    key: "configuration",
    label: "Configuration",
    icon: "settings",
    children: [
      { href: "/settings/academic-years", label: "Academic Years" },
      { href: "/settings/penalty-rules", label: "Penalty Rules" },
      { href: "/settings/users", label: "Users & Roles" },
      { href: "/settings/receipt-sequence", label: "Receipt Sequence" },
      { href: "/settings/receipt-templates", label: "Receipt Templates" },
    ],
  },
  {
    type: "group",
    key: "reports",
    label: "Reports",
    icon: "chart",
    children: [
      { href: "/reports/payment-logs", label: "Payment Logs" },
      { href: "/reports/pending-cheques", label: "Pending Cheques" },
      { href: "/reports/print-receipts", label: "Print Receipts" },
    ],
  },
];

const superAdminNav: NavItem[] = [
  { type: "item", href: "/super-admin", label: "Dashboard", icon: "grid" },
  { type: "item", href: "/tenants", label: "Tenants", icon: "building" },
  {
    type: "item",
    href: "/system-metadata",
    label: "System Metadata",
    icon: "database",
  },
  { type: "item", href: "/chat", label: "Chat", icon: "chat" },
];

function navItemsFor(role: string | undefined): NavItem[] {
  if (role === "super_admin") return superAdminNav;
  return tenantAdminNav;
}

const EASE = "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

function NavIcon({ name }: { name: string }) {
  const c = "h-[18px] w-[18px] flex-shrink-0";
  if (name === "grid")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  if (name === "document")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  if (name === "save")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    );
  if (name === "megaphone")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13a3 3 0 005.064 0M18 13a3 3 0 01-3 3h-6a3 3 0 01-3-3M18 7a3 3 0 00-3-3h-6a3 3 0 00-3 3" />
      </svg>
    );
  if (name === "students")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  if (name === "payment")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  if (name === "paynow")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  if (name === "certificate")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  if (name === "chat")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  if (name === "feed")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7" />
        <circle cx="6.5" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "approve")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  if (name === "media")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15l-5-5L5 21" />
      </svg>
    );
  if (name === "settings")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  if (name === "chart")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a1 1 0 00-1-1H5a1 1 0 00-1 1v6a1 1 0 001 1h3a1 1 0 001-1zm0 0a1 1 0 001 1h3a1 1 0 001-1V9a1 1 0 00-1-1h-3a1 1 0 00-1 1v10zm0 0h6m4 0a1 1 0 001-1V5a1 1 0 00-1-1h-3a1 1 0 00-1 1v13a1 1 0 001 1h3z" />
      </svg>
    );
  if (name === "building")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m6-14h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01M10 21v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
      </svg>
    );
  if (name === "database")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3-3.582-3-8-3-8 1.343-8 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" />
      </svg>
    );
  return null;
}

function prettyRole(role?: string) {
  if (!role) return "Member";
  return role
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUi();
  const { user, logout } = useAuth();
  const { logoUrl: brandLogoUrl, isCustom: brandIsCustom } = useTenantBranding();
  const navItems = useMemo(() => navItemsFor(user?.role), [user?.role]);

  const email = user?.email ?? "";
  const displayName =
    (email.split("@")[0] || "Admin")
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase()) || "Admin";
  const initials =
    displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const closeSidebar = () => setSidebarOpen(false);

  const initialOpenGroups = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.type === "group")
        open[item.key] = item.children.some((c) => isActive(c.href));
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navItems]);

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(initialOpenGroups);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of navItems) {
        if (
          item.type === "group" &&
          item.children.some((c) => isActive(c.href))
        )
          next[item.key] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const ACTIVE_BG =
    "linear-gradient(135deg, rgba(108,115,156,0.34), rgba(217,166,159,0.22))";

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!sidebarOpen}
        onClick={closeSidebar}
        className={`md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[270px] flex-col max-w-[85vw] ${EASE} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:translate-x-0 md:h-screen md:z-30 md:max-w-none md:flex-shrink-0`}
        style={{
          backgroundColor: "#6c739c",
          backgroundImage:
            "radial-gradient(110% 60% at 0% 0%, rgba(255,255,255,0.10), transparent 55%)," +
            "radial-gradient(90% 60% at 100% 100%, rgba(217,166,159,0.18), transparent 60%)," +
            "linear-gradient(160deg,#6c739c 0%,#5b6188 55%,#565c82 100%)",
          borderRight: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03)",
        }}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div
          className="flex min-w-0 items-center justify-between px-4 py-[18px]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className="group flex min-w-0 items-center gap-3 outline-none"
          >
            <span
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.10), 0 8px 20px -8px rgba(108,115,156,0.6)",
              }}
            >
              <Image
                src={brandLogoUrl}
                alt="SVBK"
                width={34}
                height={34}
                className="object-contain p-0.5"
                priority
                unoptimized={brandIsCustom}
              />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold tracking-tight text-white">
                SVBK
              </span>
              <span className="block truncate text-[11px] font-medium text-white/65">
                School Console
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
            Workspace
          </p>

          {navItems.map((item) => {
            if (item.type === "item") {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  title={item.label}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] ${EASE} ${
                    active
                      ? "text-white font-semibold"
                      : "text-slate-300/80 font-medium hover:text-white hover:bg-white/[0.055]"
                  }`}
                  style={
                    active
                      ? {
                          backgroundImage: ACTIVE_BG,
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -14px rgba(108,115,156,0.9)",
                        }
                      : undefined
                  }
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{
                        background: "linear-gradient(180deg,#d9a69f,#6c739c)",
                        boxShadow: "0 0 10px 1px rgba(217,166,159,0.65)",
                      }}
                    />
                  )}
                  <span
                    className={
                      active
                        ? "text-[#d9a69f]"
                        : "text-white/70 group-hover:text-[#f0dad5] transition-colors"
                    }
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }

            const open = openGroups[item.key];
            const anyChildActive = item.children.some((c) => isActive(c.href));
            return (
              <div key={item.key} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] ${EASE} ${
                    anyChildActive
                      ? "text-white font-semibold"
                      : "text-slate-300/80 font-medium hover:text-white hover:bg-white/[0.055]"
                  }`}
                >
                  <span
                    className={
                      anyChildActive
                        ? "text-[#d9a69f]"
                        : "text-white/70 group-hover:text-[#f0dad5] transition-colors"
                    }
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="flex-1 text-left truncate">
                    {item.label}
                  </span>
                  <svg
                    className={`h-3.5 w-3.5 text-white/55 transition-transform duration-300 ${
                      open ? "rotate-90" : ""
                    }`}
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div
                  className={`grid ${EASE} ${
                    open
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[22px] mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={closeSidebar}
                            className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] ${EASE} ${
                              active
                                ? "text-white font-semibold bg-white/[0.07]"
                                : "text-slate-400/80 font-medium hover:text-white hover:bg-white/[0.045]"
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0 transition-colors"
                              style={{
                                background: active
                                  ? "linear-gradient(135deg,#d9a69f,#6c739c)"
                                  : "rgba(148,163,184,0.4)",
                                boxShadow: active
                                  ? "0 0 8px 1px rgba(217,166,159,0.65)"
                                  : "none",
                              }}
                            />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div
          className="px-3 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="mb-2 flex items-center gap-3 rounded-xl px-2.5 py-2.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg,#6c739c,#d9a69f)",
                boxShadow: "0 8px 18px -8px rgba(108,115,156,0.8)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-white">
                {displayName}
              </p>
              <p className="truncate text-[11px] leading-tight text-white/60">
                {prettyRole(user?.role)}
              </p>
            </div>
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{
                background: "#34d399",
                boxShadow: "0 0 8px 1px rgba(52,211,153,0.7)",
              }}
              title="Online"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              logout();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-300/80 hover:text-rose-300 hover:bg-rose-500/10 ${EASE}`}
            title="Logout"
          >
            <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

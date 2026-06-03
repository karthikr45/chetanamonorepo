"use client";

import Link from "next/link";
import { ProtectedRoute, useAuth } from "@/features/auth";

/**
 * Minimal layout for the chat page — accessible to every authenticated
 * user (tenant admin/fin/ops + super-admin). No sidebar; just a tiny
 * header so the user can navigate back to their home.
 */
function ChatHeader() {
  const { user, logout } = useAuth();
  const home = user?.role === "super_admin" ? "/tenants" : "/dashboard";
  return (
    <header
      className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-20"
      style={{ boxShadow: "0 1px 3px rgb(0 0 0 / 0.05)" }}
    >
      <div className="flex items-center gap-4">
        <Link
          href={home}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
        <div className="leading-tight">
          <p className="font-bold text-slate-800 text-sm">Chat</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={() => logout()}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}

export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <ChatHeader />
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </ProtectedRoute>
  );
}

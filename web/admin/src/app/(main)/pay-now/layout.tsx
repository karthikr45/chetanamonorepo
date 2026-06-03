"use client";

import { useAuth } from "@/features/auth";
import { DashboardMain, Navbar, Sidebar } from "@/components/layout";

export default function PayNowLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Public users see only Pay Now content (no sidebar)
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--app-page-bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <DashboardMain>{children}</DashboardMain>
      </div>
    </div>
  );
}

import { ProtectedRoute } from "@/features/auth";
import { DashboardMain, Navbar, Sidebar } from "@/components/layout";

/**
 * Super-admin layout — same chrome as the tenant-admin dashboard so the
 * UX is consistent. The Sidebar swaps its nav items based on the JWT
 * role; super-admin sees Dashboard / Tenants / System Metadata / Chat.
 */
export default function TenantsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="flex min-h-screen bg-[var(--app-page-bg)]">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Navbar />
          <DashboardMain>{children}</DashboardMain>
        </div>
      </div>
    </ProtectedRoute>
  );
}

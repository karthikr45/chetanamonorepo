import { ProtectedRoute } from "@/features/auth";
import { DashboardMain, Navbar, Sidebar } from "@/components/layout";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute allowedRoles={["admin", "fin_admin", "ops_admin"]}>
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

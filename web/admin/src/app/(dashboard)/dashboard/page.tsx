import type { Metadata } from "next";
import {
  DashboardStats,
  RecentStudentsTable,
  WelcomeCard,
} from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard – stats and recent students",
};

export default function DashboardPage() {
  return (
    <div>
      <WelcomeCard />
      <div className="space-y-6">
        <DashboardStats />
        <RecentStudentsTable />
      </div>
    </div>
  );
}

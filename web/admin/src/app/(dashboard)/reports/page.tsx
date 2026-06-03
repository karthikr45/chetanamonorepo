import type { Metadata } from "next";
import { ReportsContent } from "./ReportsContent";

export const metadata: Metadata = {
  title: "Reports",
  description: "Fee collection, outstanding balances, and daily totals",
};

export default function ReportsPage() {
  return <ReportsContent />;
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";

export const metadata: Metadata = {
  title: "Student Records",
  description: "Per-student academic and fee history",
};

export default function StudentRecordsPage() {
  return (
    <div>
      <PageHeader
        title="Student Records"
        subtitle="Year-over-year academic, fee, and payment history per student."
      />
      <ComingSoonCard
        title="Records view coming soon"
        body="Search by admission number to see a unified timeline of fees, payments, penalties, and class progression."
      />
    </div>
  );
}

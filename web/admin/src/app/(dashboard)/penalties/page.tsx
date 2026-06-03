import type { Metadata } from "next";
import { PageHeader } from "@/components/layout";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";

export const metadata: Metadata = {
  title: "Penalties",
  description: "Manage late-fee penalties",
};

export default function PenaltiesPage() {
  return (
    <div>
      <PageHeader
        title="Penalties"
        subtitle="Define late-fee rules and waivers. Penalties roll into the student's term fee automatically."
      />
      <ComingSoonCard
        title="Penalty management is on the way"
        body="Configure auto-applied late fees by branch and term. Apply or waive individual penalties from a student's fee record."
      />
    </div>
  );
}

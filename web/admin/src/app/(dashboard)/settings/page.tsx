import type { Metadata } from "next";
import { PageHeader } from "@/components/layout";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";

export const metadata: Metadata = {
  title: "Settings",
  description: "Tenant settings",
};

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Tenant configuration, branding, and integrations."
      />
      <ComingSoonCard
        title="Settings panel under construction"
        body="Manage academic-year defaults, payment gateway credentials, SMTP, branding, and notification preferences."
      />
    </div>
  );
}

import type { Metadata } from "next";
import { CommunicationsWorkspace } from "./CommunicationsWorkspace";

export const metadata: Metadata = {
  title: "Communications",
  description: "Announcements and message templates in one place",
};

export default function CommunicationsPage() {
  return <CommunicationsWorkspace />;
}

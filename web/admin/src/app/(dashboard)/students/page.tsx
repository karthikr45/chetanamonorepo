import type { Metadata } from "next";
import { StudentsPageContent } from "./StudentsPageContent";

export const metadata: Metadata = {
  title: "Students",
  description: "Manage students – view records and upload data",
};

export default function StudentsPage() {
  return <StudentsPageContent />;
}

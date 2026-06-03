import type { Metadata } from "next";
import { ViewPageContent } from "./ViewPageContent";

export const metadata: Metadata = {
  title: "View",
  description: "View – add your data or functionality here",
};

export default function ViewPage() {
  return (
    <ViewPageContent />
  );
}
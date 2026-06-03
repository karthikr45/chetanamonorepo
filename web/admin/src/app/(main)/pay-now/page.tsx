import type { Metadata } from "next";
import { PayNowPageContent } from "./PayNowPageContent";

export const metadata: Metadata = {
  title: "Pay Now",
  description: "Search and pay student fees",
};

export default function PayNowPage() {
  return <PayNowPageContent />;
}

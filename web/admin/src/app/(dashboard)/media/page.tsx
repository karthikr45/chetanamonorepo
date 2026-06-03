import type { Metadata } from "next";
import { MediaWorkspace } from "./MediaWorkspace";

export const metadata: Metadata = {
  title: "Media",
  description: "Browse and upload media in one place",
};

export default function MediaPage() {
  return <MediaWorkspace />;
}

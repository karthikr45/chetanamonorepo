import type { ReactNode } from "react";

/**
 * The public feed has its own minimal layout — no auth, no app shell.
 * Premium typography is wired at the root layout via CSS variables
 * --font-display (Fraunces) and --font-body (Inter); we just apply
 * them here.
 */
export default function FeedLayout({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>{children}</div>;
}

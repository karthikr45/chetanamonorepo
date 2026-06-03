"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BackLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

export function BackLink({ href = "/", children = "Back", className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "auth-back-link mb-6 inline-flex items-center text-sm",
        "text-[var(--auth-back-link)] hover:text-[var(--auth-back-link-hover)]",
        className
      )}
    >
      <svg
        className="mr-1 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {children}
    </Link>
  );
}

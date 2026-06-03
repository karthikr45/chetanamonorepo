import { cn } from "@/lib/utils";
import type { TenantCardContentProps } from "./types";

/**
 * TenantCardContent - body of a tenant card. Renders a 2-col grid of fields.
 */
export function TenantCardContent({
  children,
  className,
}: TenantCardContentProps) {
  return (
    <div
      className={cn(
        "mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 pt-4 border-t border-[var(--app-divider)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

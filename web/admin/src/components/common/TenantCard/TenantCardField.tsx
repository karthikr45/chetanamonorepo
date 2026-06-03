import { cn } from "@/lib/utils";
import type { TenantCardFieldProps } from "./types";

const sizeStyles = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/**
 * TenantCardField - label + value row in a tenant card.
 * Premium: tiny uppercase caption + value below.
 */
export function TenantCardField({
  label,
  value,
  size = "sm",
  className,
}: TenantCardFieldProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
        {label}
      </span>
      <span className={cn("font-medium text-[var(--app-text-primary)]", sizeStyles[size])}>
        {value}
      </span>
    </div>
  );
}

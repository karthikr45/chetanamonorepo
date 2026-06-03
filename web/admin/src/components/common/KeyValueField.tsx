import { cn } from "@/lib/utils";

export interface KeyValueFieldProps {
  label: string;
  value: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * KeyValueField - Premium read-only label/value display.
 * Tiny uppercase caption + value, no border by default (use inside a Card).
 */
export function KeyValueField({
  label,
  value,
  className,
  size = "md",
}: KeyValueFieldProps) {
  const sizeStyles = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
        {label}
      </span>
      <span className={cn("font-semibold text-[var(--app-text-primary)]", sizeStyles[size])}>
        {value || <span className="font-normal text-[var(--app-text-muted)]">—</span>}
      </span>
    </div>
  );
}

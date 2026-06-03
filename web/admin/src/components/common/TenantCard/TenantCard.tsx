import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { TenantCardProps } from "./types";

/**
 * TenantCard - Composable card for tenants. Premium look: clean border,
 * subtle hover lift, brand-blue selection ring + soft surface.
 */
export function TenantCard({
  isSelected = false,
  onClick,
  className,
  children,
}: TenantCardProps) {
  const interactive = Boolean(onClick);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  };

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        "group relative rounded-[var(--app-card-radius)] border bg-white p-5 text-left transition-all duration-200",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--app-card-shadow-hover)]",
        interactive &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/40",
        isSelected
          ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] shadow-[var(--app-card-shadow)]"
          : "border-[var(--app-card-border)] shadow-[var(--app-card-shadow)]",
        className,
      )}
    >
      {isSelected && (
        <span
          className="absolute -top-px left-5 right-5 h-0.5 rounded-b"
          style={{ backgroundColor: "var(--app-brand)" }}
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

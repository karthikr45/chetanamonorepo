import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Density: "default" (premium roomy) or "tight" for tables/list items. */
  padding?: "none" | "tight" | "default" | "loose";
  /** Add a subtle hover lift. */
  interactive?: boolean;
}

const paddingMap = {
  none: "p-0",
  tight: "p-4",
  default: "p-6",
  loose: "p-8",
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = "default", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--app-card-radius)] border bg-[var(--app-card-bg)]",
        "border-[var(--app-card-border)] shadow-[var(--app-card-shadow)]",
        "transition-shadow duration-200",
        interactive && "hover:shadow-[var(--app-card-shadow-hover)] hover:border-slate-300",
        paddingMap[padding],
        className
      )}
      {...props}
    />
  )
);

Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...props} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-base font-semibold tracking-tight text-[var(--app-text-primary)]",
      className
    )}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--app-text-secondary)]", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

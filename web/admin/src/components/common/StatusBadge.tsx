"use client";

export type StatusVariant = "success" | "warning" | "danger" | "neutral";

const variantStyles: Record<StatusVariant, { bg: string; color: string }> = {
  success: { bg: "var(--app-success-bg)", color: "var(--app-success)" },
  warning: { bg: "var(--app-warning-bg)", color: "var(--app-warning)" },
  danger: { bg: "var(--app-danger)", color: "#fff" },
  neutral: { bg: "var(--app-search-bg)", color: "var(--app-text-secondary)" },
};

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ children, variant = "neutral", className = "" }: StatusBadgeProps) {
  const style = variantStyles[variant];
  return (
    <span
      className={"inline-flex rounded-full px-3 py-1 text-xs font-medium transition-opacity duration-200 " + className}
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {children}
    </span>
  );
}

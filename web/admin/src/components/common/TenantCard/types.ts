import type { ReactNode } from "react";

export interface TenantCardProps {
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  className?: string;
  children: ReactNode;
}

export interface TenantCardHeaderProps {
  title: string;
  subtitle?: string;
  showCheckmark?: boolean;
  /** Shown when provided; uses a focusable control (not nested inside a native `<button>`). */
  onEdit?: () => void;
  /** Shown when provided; uses a focusable control (not nested inside a native `<button>`). */
  onDelete?: () => void;
  className?: string;
}

export interface TenantCardContentProps {
  children: ReactNode;
  className?: string;
}

export interface TenantCardFieldProps {
  label: string;
  value: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

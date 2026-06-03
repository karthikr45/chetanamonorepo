import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "auth";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "text-white shadow-sm bg-[var(--app-brand)] hover:bg-[var(--app-brand-hover)] " +
    "focus-visible:ring-[var(--app-brand)] active:scale-[0.99]",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm active:scale-[0.99]",
  /** Auth screens: uses CSS variables from globals.css */
  auth:
    "bg-[var(--auth-btn-signin-bg)] text-white hover:bg-[var(--auth-btn-signin-hover)] active:bg-[var(--auth-btn-signin-active)] " +
    "focus-visible:ring-[var(--auth-input-focus)] uppercase tracking-wide font-bold transition-all duration-200 ease-out active:scale-[0.99]",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-9 px-3 text-sm gap-2 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? isLoading}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="opacity-90">Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  )
);

Button.displayName = "Button";

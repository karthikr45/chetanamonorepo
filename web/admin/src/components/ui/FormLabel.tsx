"use client";

import { type LabelHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Use accent (blue) color for the label, e.g. username field */
  accent?: boolean;
  /** Show red required asterisk after the label */
  required?: boolean;
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, accent, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium transition-colors duration-200 ease-out",
        accent
          ? "text-[var(--auth-label-accent)] dark:text-[var(--auth-label-accent)]"
          : "text-[var(--auth-label-default)] dark:text-[var(--auth-label-default)]",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-[var(--auth-required-asterisk)]">*</span>}
    </label>
  )
);

FormLabel.displayName = "FormLabel";

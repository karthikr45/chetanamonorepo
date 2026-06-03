"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputBorderedProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  fullWidth?: boolean;
}

export const InputBordered = forwardRef<HTMLInputElement, InputBorderedProps>(
  ({ className, error, fullWidth, id, ...props }, ref) => (
    <div className={cn("flex flex-col gap-2", fullWidth && "w-full")}>
      <input
        ref={ref}
        id={id}
        className={cn("input-bordered-field", className)}
        aria-invalid={!!error}
        aria-describedby={error && id ? `${id}-error` : undefined}
        {...props}
      />
      {error && id && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
);

InputBordered.displayName = "InputBordered";

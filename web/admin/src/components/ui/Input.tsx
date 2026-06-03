import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, fullWidth, id, type = "text", required, ...props },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          autoComplete={
            type === "email"
              ? "email"
              : type === "password"
                ? "off"
                : undefined
          }
          className={cn(
            "h-11 rounded-lg border bg-transparent px-3 py-2 text-base transition-colors",
            "border-zinc-300 dark:border-zinc-600",
            "placeholder:text-zinc-500 dark:placeholder:text-zinc-400",
            "placeholder:transition-opacity focus:placeholder:opacity-0",
            "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
            fullWidth && "w-full",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-required={required}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

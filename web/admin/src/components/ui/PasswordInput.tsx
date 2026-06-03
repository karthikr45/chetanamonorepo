"use client";

import { useState, forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
  fullWidth?: boolean;
}

const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, fullWidth, id, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className={cn("flex flex-col gap-2", fullWidth && "w-full")}>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? "text" : "password"}
            className={cn("input-bordered", className)}
            aria-invalid={!!error}
            aria-describedby={error && id ? `${id}-error` : undefined}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((p) => !p)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 transition-[transform,background-color] duration-200 ease-out hover:scale-110 hover:bg-zinc-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--auth-input-focus)]/30 dark:bg-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-500"
            aria-label={show ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && id && (
          <p id={`${id}-error`} className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

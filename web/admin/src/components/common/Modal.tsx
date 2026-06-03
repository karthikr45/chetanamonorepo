"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max-width class, defaults to max-w-lg */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  footer?: ReactNode;
  mobileFullscreen?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "lg", footer, mobileFullscreen = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className={`flex w-full min-h-full justify-center ${mobileFullscreen ? "items-center p-3 md:p-4" : "items-center p-2 sm:p-4"}`}>
        <div
          className={`flex w-full ${mobileFullscreen ? "max-h-[calc(100vh-1.5rem)] rounded-2xl md:max-h-[90vh]" : "max-h-[90vh] rounded-2xl"} flex-col ${sizeMap[size] ?? sizeMap.lg} animate-[modal-in_0.2s_ease-out] border shadow-xl`}
          style={{
            backgroundColor: "var(--app-card-bg)",
            borderColor: "var(--app-divider)",
          }}
        >
          {/* Header */}
          {title && (
            <div
              className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
              style={{ borderColor: "var(--app-divider)" }}
            >
              <h2 className="text-lg font-semibold" style={{ color: "var(--app-text-primary)" }}>
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--app-nav-hover-bg)]"
                style={{ color: "var(--app-text-secondary)" }}
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Body – scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-visible overscroll-y-contain px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </div>

          {/* Footer – stays fixed at bottom */}
          {footer && (
            <div
              className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:gap-3 sm:px-6 sm:py-4"
              style={{ borderColor: "var(--app-divider)" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectMenuOption = { value: string; label: string; disabled?: boolean };

export interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  /** When `value` equals this, the trigger shows the placeholder label. */
  emptyValue?: string;
  disabled?: boolean;
  usePortal?: boolean;
  className?: string;
  "aria-label"?: string;
}

type PanelCoords = { top: number; left: number; width: number; maxHeight: number };
type RectLike = { top: number; bottom: number };

const transitionClass =
  "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  let node = element.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollable = /(auto|scroll|overlay)/.test(overflowY);
    if (isScrollable && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyValue = "",
  disabled = false,
  usePortal = true,
  className = "",
  "aria-label": ariaLabel,
}: SelectMenuProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PanelCoords>({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const [inlineOpenUp, setInlineOpenUp] = useState(false);
  const [inlineMaxHeight, setInlineMaxHeight] = useState(280);

  const isEmpty = value === emptyValue || value === "";
  const selectedLabel = options.find((o) => o.value === value)?.label;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;

    let width = Math.max(r.width, Math.min(360, vw - pad * 2));
    let left = r.left + (r.width - width) / 2;
    if (left + width > vw - pad) left = vw - pad - width;
    if (left < pad) left = pad;

    const gap = 6;
    let top = r.bottom + gap;
    let maxHeight = Math.min(280, vh - top - pad);

    if (maxHeight < 100 && r.top > pad + gap + 120) {
      maxHeight = Math.min(280, r.top - pad - gap);
      top = r.top - gap - maxHeight;
    }

    setCoords({ top, left, width, maxHeight: Math.max(100, maxHeight) });
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!usePortal) return;
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const ro = triggerRef.current ? new ResizeObserver(updatePosition) : null;
    if (triggerRef.current && ro) ro.observe(triggerRef.current);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, [open, updatePosition, usePortal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open]);

  useEffect(() => {
    if (!open || usePortal) return;
    const el = triggerRef.current;
    if (!el) return;

    const updateInlinePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const gap = 6;
      const pad = 8;
      const scrollParent = getScrollParent(trigger);
      const containerRect: RectLike = scrollParent
        ? scrollParent.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };

      const spaceBelow = Math.max(containerRect.bottom - r.bottom - gap - pad, 100);
      const spaceAbove = Math.max(r.top - containerRect.top - gap - pad, 100);
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const nextOpenUp = openUp;
      const nextMax = Math.min(280, openUp ? spaceAbove : spaceBelow);
      setInlineOpenUp((prev) => (prev === nextOpenUp ? prev : nextOpenUp));
      setInlineMaxHeight((prev) => (Math.abs(prev - nextMax) < 2 ? prev : nextMax));
    };

    updateInlinePosition();
    // Do not subscribe to ancestor/window scroll: when the list is scrolled (esp. at the last
    // item), scroll chaining fires on the modal body and repositioning thrashes layout ("hanging"
    // on mobile). Resize still updates geometry.
    window.addEventListener("resize", updateInlinePosition);
    return () => {
      window.removeEventListener("resize", updateInlinePosition);
    };
  }, [open, usePortal]);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const panelBody = (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1.5 touch-pan-y"
      onWheel={(e) => e.stopPropagation()}
    >
      {options.length === 0 ? (
        <p className="px-3 py-3 text-sm" style={{ color: "var(--app-text-secondary)" }}>
          No options
        </p>
      ) : (
        options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && handleSelect(opt.value)}
              className={
                "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium outline-none " +
                transitionClass +
                " disabled:cursor-not-allowed disabled:opacity-40 " +
                (selected ? "bg-[var(--app-nav-hover-bg)]" : "hover:bg-[var(--app-nav-hover-bg)]")
              }
              style={{ color: "var(--app-text-primary)" }}
            >
              {opt.label}
            </button>
          );
        })
      )}
    </div>
  );

  const portalPanel =
    mounted &&
    open &&
    usePortal &&
    createPortal(
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border shadow-lg"
        style={{
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
          backgroundColor: "var(--app-card-bg)",
          borderColor: "var(--app-search-border)",
        }}
      >
        {panelBody}
      </div>,
      document.body
    );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={
          "inline-flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl border bg-[var(--app-card-bg)] px-4 text-left text-base outline-none " +
          transitionClass +
          " focus:ring-2 focus:ring-[var(--app-search-focus)]/20 disabled:cursor-not-allowed disabled:opacity-50 " +
          className
        }
        style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
      >
        <span className="truncate">{isEmpty ? placeholder : (selectedLabel ?? value)}</span>
        <svg className="h-4 w-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && !usePortal && (
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          className={
            "absolute left-0 z-30 flex w-full flex-col overflow-hidden overscroll-y-contain rounded-xl border shadow-lg touch-manipulation " +
            (inlineOpenUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]")
          }
          style={{
            maxHeight: inlineMaxHeight,
            backgroundColor: "var(--app-card-bg)",
            borderColor: "var(--app-search-border)",
            overscrollBehaviorY: "contain",
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {panelBody}
        </div>
      )}
      {portalPanel}
    </div>
  );
}

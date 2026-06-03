"use client";

export interface ActionItem {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}

export interface IconActionsProps {
  actions: ActionItem[];
  className?: string;
}

export function IconActions({ actions, className = "" }: IconActionsProps) {
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="group"
      aria-label="Row actions"
    >
      {actions.map(({ label, onClick, icon }, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-[background-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--app-nav-hover-bg)] hover:opacity-90"
          style={{ color: "var(--app-nav-icon)" }}
          title={label}
          aria-label={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

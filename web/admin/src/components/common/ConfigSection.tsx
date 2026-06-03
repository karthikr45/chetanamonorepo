import { cn } from "@/lib/utils";

export interface ConfigSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ConfigSection - Container for grouping related configuration fields
 * Typically used in forms or settings pages
 * 
 * Usage:
 * ```tsx
 * <ConfigSection title="General Settings">
 *   <Input label="Name" />
 * </ConfigSection>
 * ```
 */
export function ConfigSection({
  title,
  description,
  children,
  className,
}: ConfigSectionProps) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[var(--app-text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

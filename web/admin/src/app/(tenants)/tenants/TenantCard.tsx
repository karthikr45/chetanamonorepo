
import { Tenant } from "@/features/tenants/tenantData";

function TenantCard({
  tenant,
  isSelected,
  onClick,
}: {
  tenant: Tenant;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 ${
        isSelected
          ? "border-foreground bg-[var(--app-card-bg)] shadow-lg"
          : "border-zinc-200 bg-white hover:border-foreground"
      }`}
      style={{
        boxShadow: isSelected ? "0 0 0 2px var(--app-brand)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-[var(--app-text-primary)]">{tenant.name}</p>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{tenant.tenantName}</p>
        </div>
        {isSelected && (
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background"
            aria-hidden="true"
          >
            ✓
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 text-sm text-[var(--app-text-secondary)]">
        <p>
          <span className="font-medium text-[var(--app-text-primary)]">School Code:</span> {tenant.code}
        </p>
        <p>
          <span className="font-medium text-[var(--app-text-primary)]">Tenant Code:</span> {tenant.tenantCode}
        </p>
        <p>
          <span className="font-medium text-[var(--app-text-primary)]">Location:</span> {tenant.city}, {tenant.state}
        </p>
      </div>
    </button>
  );
}

export default TenantCard;
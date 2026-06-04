"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal, SelectMenu } from "@/components/common";
import { Tenant } from "@/features/tenants/tenantData";
import { getTenants, saveTenant, updateTenant } from "@/features/tenants/services/tenants.service";
import { TenantCard } from "@/components/common/TenantCard/TenantCard";
import { TenantCardContent, TenantCardField, TenantCardHeader } from "@/components/common";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

const FALLBACK_INSTITUTION_TYPES = ["School", "Hostel", "Transport"];
const FALLBACK_MEDIUMS = ["Telugu", "English"];
const FALLBACK_BOARD_TYPES = ["CBSE", "State"];

const emptyForm: Omit<Tenant, "id"> = {
  type: "",
  name: "",
  code: "",
  medium: "",
  boardType: "",
  tenantCode: "",
  tenantName: "",
  address: "",
  city: "",
  state: "",
  country: "",
  receiptPrefix: "",
  receiptResetPolicy: "ACADEMIC_YEAR",
  receiptStartNumber: 1,
};

const RESET_POLICY_OPTIONS = [
  { value: "ACADEMIC_YEAR", label: "Reset per academic year" },
  { value: "YEARLY", label: "Reset per calendar year" },
  { value: "MONTHLY", label: "Reset per month" },
  { value: "DAILY", label: "Reset per day" },
  { value: "NEVER", label: "Never reset (single global sequence)" },
] as const;

/** Auto-generates tenant code from name + optional code + board type.
 *  Example: "Ushodaya" + code "Alpha" + "CBSE" → "UACBSE"
 */
function generateTenantCode(name: string, code: string, boardType: string, medium: string): string {
  const n = name.trim()[0]?.toUpperCase() ?? "";
  const c = code.trim()?.toUpperCase() ?? "";
  const m=medium.trim()[0]?.toUpperCase() ?? "";
  return `${n}${c}${m}${boardType}`;
}

function FormSelectMenu({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
  ariaLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  error?: string;
  placeholder: string;
  required?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <SelectMenu
        aria-label={ariaLabel}
        value={value}
        emptyValue=""
        onChange={onChange}
        placeholder={placeholder}
        options={options.map((opt) => ({ value: opt, label: opt }))}
        usePortal={false}
        className={error ? "w-full ring-2 ring-red-500/80 ring-offset-1 ring-offset-[var(--app-card-bg)]" : "w-full"}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TenantManagement() {
  const router = useRouter();
  const instMeta = useMetadata("tenant_type", {
    fallback: FALLBACK_INSTITUTION_TYPES.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const mediumMeta = useMetadata("medium", {
    fallback: FALLBACK_MEDIUMS.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const boardMeta = useMetadata("board_type", {
    fallback: FALLBACK_BOARD_TYPES.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  // Country / state / city dropdowns are seeded with sensible defaults
  // and editable by super-admin via the System Metadata UI — no code
  // change needed to add a new city or country.
  const countryMeta = useMetadata("country", {
    fallback: [{ value: "India", label: "India", displayOrder: 1, isActive: true }],
  });

  console.log("countryMeta", countryMeta);
  const stateMeta = useMetadata("state", {
    fallback: [{ value: "Telangana", label: "Telangana", displayOrder: 1, isActive: true }],
  });
  console.log("stateMeta", stateMeta);
  const cityMeta = useMetadata("city", {
    fallback: [{ value: "Hyderabad", label: "Hyderabad", displayOrder: 1, isActive: true }],
  });
  const INSTITUTION_TYPES = useMemo(
    () => instMeta.options.map((o) => o.value),
    [instMeta.options],
  );
  const MEDIUMS = useMemo(
    () => mediumMeta.options.map((o) => o.value),
    [mediumMeta.options],
  );
  const COUNTRIES = useMemo(
    () => countryMeta.options.map((o) => ({ value: o.value, label: o.label })),
    [countryMeta.options],
  );
  const STATES = useMemo(
    () => stateMeta.options.map((o) => ({ value: o.value, label: o.label })),
    [stateMeta.options],
  );
  const CITIES = useMemo(
    () => cityMeta.options.map((o) => ({ value: o.value, label: o.label })),
    [cityMeta.options],
  );
  const BOARD_TYPES = useMemo(
    () => boardMeta.options.map((o) => o.value),
    [boardMeta.options],
  );

  console.log('States:', STATES);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("All");
  const [filterState, setFilterState] = useState("All");
  const [selectedId, setSelectedId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [formData, setFormData] = useState<Omit<Tenant, "id">>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof Omit<Tenant, "id">, string>>>({});

  const generatedTenantCode = useMemo(
    () => generateTenantCode(formData.name, formData.code, formData.boardType, formData.medium),
    [formData.name, formData.code, formData.boardType, formData.medium]
  );

  // Board is optional for Hostel / Transport tenants, required otherwise.
  const isBoardRequired = !["hostel", "transport"].includes(formData.type.trim().toLowerCase());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTenants()
      .then((list) => {
        if (cancelled) return;
        setTenants(list);
        setSelectedId(list[0]?.id ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const cityOptions = useMemo(
    () => [
      { value: "All", label: "All" },
      ...Array.from(new Set(tenants.map((t) => (t.city ?? "").trim()).filter(Boolean)))
        .sort()
        .map((city) => ({ value: city, label: city })),
    ],
    [tenants]
  );
  const stateOptions = useMemo(
    () => [
      { value: "All", label: "All" },
      ...Array.from(new Set(tenants.map((t) => (t.state ?? "").trim()).filter(Boolean)))
        .sort()
        .map((state) => ({ value: state, label: state })),
    ],
    [tenants]
  );

  const filteredTenants = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const city = (tenant.city ?? "").trim().toLowerCase();
      const matchesSearch =
        normalized === "" ||
        tenant.name.toLowerCase().includes(normalized) ||
        tenant.code.toLowerCase().includes(normalized) ||
        tenant.tenantCode.toLowerCase().includes(normalized) ||
        city.includes(normalized);
      const matchesCity = filterCity === "All" || (tenant.city ?? "").trim() === filterCity;
      const matchesState = filterState === "All" || (tenant.state ?? "").trim() === filterState;
      return matchesSearch && matchesCity && matchesState;
    });
  }, [tenants, search, filterCity, filterState]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTenants = filteredTenants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetForm = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setSaveError("");
  };

  const validate = () => {
    const errors: Partial<Record<keyof Omit<Tenant, "id">, string>> = {};
    // schoolCode is optional; tenantCode is auto-generated — skip both
    const optional = new Set<string>([
      "schoolCode",
      "tenantCode",
      "receiptPrefix",
      "receiptResetPolicy",
      "receiptStartNumber",
    ]);
    (Object.keys(formData) as Array<keyof typeof formData>).forEach((key) => {
      if (optional.has(key)) return;
      // Board is not mandatory for Hostel / Transport tenants
      if (key === "boardType" && !isBoardRequired) return;
      const val = formData[key];
      if (typeof val === "string" && !val.trim()) errors[key] = "This field is required";
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onOpenDrawer = () => {
    setEditingTenant(null);
    resetForm();
    setDrawerOpen(true);
  };

  const onOpenEdit = (tenant: Tenant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTenant(tenant);
    setFormData({
      type: tenant.type ?? "",
      name: tenant.name,
      code: tenant.code,
      medium: tenant.medium ?? "",
      boardType: tenant.boardType ?? "",
      tenantCode: tenant.tenantCode,
      tenantName: tenant.tenantName,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country,
      receiptPrefix: tenant.receiptPrefix ?? "",
      receiptResetPolicy: tenant.receiptResetPolicy ?? "ACADEMIC_YEAR",
      receiptStartNumber: tenant.receiptStartNumber ?? 1,
    });
    setFormErrors({});
    setSaveError("");
    setDrawerOpen(true);
  };

  const onSaveTenant = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      const dataToSave = { ...formData, tenantCode: generatedTenantCode, receiptPrefix: formData.code };
      if (editingTenant) {
        await updateTenant(editingTenant.id, dataToSave);
      } else {
        const newTenant = await saveTenant(dataToSave);
        setSelectedId(newTenant.id);
      }
      const refreshed = await getTenants();
      setTenants(refreshed);
      setDrawerOpen(false);
      resetForm();
      setPage(1);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save tenant. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onCardSelect = (id: string) => {
    setSelectedId(id);
    router.push(`/tenants/${id}`);
  };

  const isEditMode = editingTenant !== null;

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
            Tenants
          </h1>
          <p className="mt-1.5 text-sm text-[var(--app-text-secondary)] max-w-2xl leading-relaxed">
            Manage every school tenant on the SVBK platform. Click a tenant to view its configuration, admins, and academic data.
          </p>
        </div>
        <Button onClick={onOpenDrawer} size="md" variant="primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add tenant
        </Button>
      </header>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="Search"
            placeholder="Search by name, tenant code, or city..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            fullWidth
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">City</label>
            <SelectMenu
              aria-label="Filter by city"
              value={filterCity}
              onChange={(v) => { setFilterCity(v); setPage(1); }}
              options={cityOptions}
              placeholder="All"
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">State</label>
            <SelectMenu
              aria-label="Filter by state"
              value={filterState}
              onChange={(v) => { setFilterState(v); setPage(1); }}
              options={stateOptions}
              placeholder="All"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800" />
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
          <p className="text-xl font-semibold">No tenants found</p>
          <p className="mt-2">Try changing search or filter options, or add a new tenant.</p>
          <Button className="mt-4" onClick={onOpenDrawer} variant="primary">+ Add Tenant</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="rounded-xl border-2 border-dashed border-zinc-300 bg-white p-5 text-left transition hover:border-foreground hover:bg-[var(--app-card-bg)]"
            >
              <div className="flex h-full flex-col justify-center gap-2 text-zinc-500">
                <span className="text-3xl font-bold">+</span>
                <span className="font-medium">New Tenant</span>
                <span className="text-sm">Add a new tenant configuration</span>
              </div>
            </button>

            {paginatedTenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                isSelected={selectedId === tenant.id}
                onClick={() => onCardSelect(tenant.id)}
                onEdit={(e) => onOpenEdit(tenant, e)}
              >
                <TenantCardHeader
                  title={tenant.name}
                  subtitle={tenant.tenantName}
                  showCheckmark={selectedId === tenant.id}
                />
                <TenantCardContent>
                  <TenantCardField label="Code" value={tenant.code} size="sm" />
                  <TenantCardField label="Tenant Code" value={tenant.tenantCode} size="sm" />
                  <TenantCardField label="Location" value={`${tenant.city}, ${tenant.state}`} size="sm" />
                </TenantCardContent>
              </TenantCard>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--app-text-secondary)]">
              Showing {paginatedTenants.length} of {filteredTenants.length} tenant(s)
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} variant="outline" size="sm">Previous</Button>
              <span className="text-sm text-[var(--app-text-secondary)]">Page {currentPage} of {totalPages}</span>
              <Button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); resetForm(); }}
        title={isEditMode ? "Edit Tenant" : "Add Tenant"}
        size="full"
      >
        <div className="mx-auto flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--app-card-bg)]">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <h2 className="mb-3 text-xl font-bold text-[var(--app-text-primary)]">Tenant details</h2>
            <p className="mb-5 text-sm text-[var(--app-text-secondary)]">
              Fill in the tenant information. Fields marked with * are required.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Type — full width, first */}
              <div className="sm:col-span-2">
                <FormSelectMenu
                  label="Type"
                  ariaLabel="Tenant type"
                  value={formData.type}
                  onChange={(v) => setFormData({ ...formData, type: v })}
                  options={INSTITUTION_TYPES}
                  error={formErrors.type}
                  placeholder="Select type"
                  required
                />
              </div>

              <Input
                label="Name"
                placeholder="e.g. Ushodaya"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
                required
                fullWidth
              />
              <Input
                label="Code"
                placeholder="e.g. 34"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                error={formErrors.code}
                required
                fullWidth
              />

              <FormSelectMenu
                label="Medium"
                ariaLabel="Medium of instruction"
                value={formData.medium}
                onChange={(v) => setFormData({ ...formData, medium: v })}
                options={MEDIUMS}
                error={formErrors.medium}
                placeholder="Select medium"
                required
              />
              <FormSelectMenu
                label="Board"
                ariaLabel="Board type"
                value={formData.boardType}
                onChange={(v) => setFormData({ ...formData, boardType: v })}
                options={BOARD_TYPES}
                error={formErrors.boardType}
                placeholder="Select board"
                required={isBoardRequired}
              />

              {/* Tenant Code — readonly, auto-generated */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tenant Code <span className="ml-1 text-xs font-normal text-zinc-400">(auto-generated)</span>
                </label>
                <div className="flex h-11 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base font-mono text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {generatedTenantCode || (
                    <span className="text-zinc-400">Fill Name, Medium &amp; Board to generate</span>
                  )}
                </div>
              </div>

              <Input
                label="Tenant Name"
                placeholder="e.g. Ushodaya High School"
                value={formData.tenantName}
                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                error={formErrors.tenantName}
                required
                fullWidth
              />

              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  error={formErrors.address}
                  required
                  fullWidth
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  City <span className="text-red-500">*</span>
                </span>
                <SelectMenu
                  aria-label="City"
                  value={formData.city}
                  emptyValue=""
                  usePortal={false}
                  onChange={(v) => setFormData({ ...formData, city: v })}
                  placeholder="Select city"
                  options={CITIES}
                  className={
                    "w-full min-w-0 " +
                    (formErrors.city
                      ? "ring-2 ring-red-500/80 ring-offset-1 ring-offset-[var(--app-card-bg)]"
                      : "")
                  }
                />
                {formErrors.city && (
                  <p className="text-sm text-red-600">{formErrors.city}</p>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  State <span className="text-red-500">*</span>
                </span>
                <SelectMenu
                  aria-label="State"
                  value={formData.state}
                  emptyValue=""
                  usePortal={false}
                  onChange={(v) => setFormData({ ...formData, state: v })}
                  placeholder="Select state"
                  options={STATES}
                  className={
                    "w-full min-w-0 " +
                    (formErrors.state
                      ? "ring-2 ring-red-500/80 ring-offset-1 ring-offset-[var(--app-card-bg)]"
                      : "")
                  }
                />
                {formErrors.state && (
                  <p className="text-sm text-red-600">{formErrors.state}</p>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Country <span className="text-red-500">*</span>
                </span>
                <SelectMenu
                  aria-label="Country"
                  value={formData.country}
                  emptyValue=""
                  usePortal={false}
                  onChange={(v) => setFormData({ ...formData, country: v })}
                  placeholder="Select country"
                  options={COUNTRIES}
                  className={
                    "w-full min-w-0 " +
                    (formErrors.country
                      ? "ring-2 ring-red-500/80 ring-offset-1 ring-offset-[var(--app-card-bg)]"
                      : "")
                  }
                />
                {formErrors.country && (
                  <p className="text-sm text-red-600">{formErrors.country}</p>
                )}
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-zinc-200 p-4 bg-zinc-50/50">
              <h3 className="text-sm font-bold text-zinc-700 mb-1">Receipt numbering</h3>
              <p className="text-xs text-zinc-500 mb-3">
                Controls the running receipt numbers issued by this tenant.
                Existing receipts keep their old format.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Receipt prefix"
                  value={formData.code}
                  readOnly
                  placeholder="Derived from Code"
                  fullWidth
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Reset policy</label>
                  <select
                    value={formData.receiptResetPolicy ?? "ACADEMIC_YEAR"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        receiptResetPolicy: e.target.value as Tenant["receiptResetPolicy"],
                      })
                    }
                    className="h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-[#6c739c] focus:ring-2 focus:ring-[#6c739c]/20"
                  >
                    {RESET_POLICY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Start number"
                  type="number"
                  value={String(formData.receiptStartNumber ?? 1)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      receiptStartNumber: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  fullWidth
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Sample: <code className="font-mono">{(formData.code || "RCP").toUpperCase()}-2025-26/0001</code>
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-[var(--app-card-bg)] p-4">
            {saveError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => { setDrawerOpen(false); resetForm(); }}
                disabled={saving}
                fullWidth
                className="sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={onSaveTenant}
                isLoading={saving}
                disabled={saving}
                fullWidth
                className="sm:w-auto"
              >
                {saving ? "Saving..." : isEditMode ? "Update Tenant" : "Save Tenant"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TenantManagement;

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tenant } from "@/features/tenants/tenantData";
import { getTenantById } from "@/features/tenants/services/tenants.service";
import {
  deleteTenantConfigByIdApi,
  getTenantConfigRecordId,
  getTenantConfigsByTenantIdApi,
  saveTenantConfigApi,
  type SaveTenantConfigPayload,
} from "@/features/tenants/api/tenants.api";
import { getApiErrorMessage } from "@/lib/api-client";
import { Modal, SelectMenu, type SelectMenuOption } from "@/components/common";
import TenantConfigurationTab from "./TenantConfigurationTab";
import TenantDetailsTab from "./TenantDetailsTab";
import TenantAdminsTab from "./TenantAdminsTab";
import { saveAdmin } from "@/features/admins/services/admins.service";
import { listSystemMetadataApi } from "@/features/system-metadata/api/system-metadata.api";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

type NewConfig = {
  envType: string;
  configName: string;
  logoUrl: string;
  receiptLogoUrl: string;
  domainUrl: string;
  storageTab: "accessKeys" | "connectionString";
  accessKey: string;
  secretKey: string;
  bucketName: string;
  containerName: string;
  gatewayType: string;
  paymentKey: string;
  paymentSecret: string;
  paymentMode: string;
  webhookUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFromName: string;
  smtpFromEmail: string;
  smtpSecure: boolean;
};

const emptyConfig: NewConfig = {
  envType: "",
  configName: "",
  logoUrl: "",
  receiptLogoUrl: "",
  domainUrl: "",
  storageTab: "accessKeys",
  accessKey: "",
  secretKey: "",
  bucketName: "",
  containerName: "",
  gatewayType: "",
  paymentKey: "",
  paymentSecret: "",
  paymentMode: "test",
  webhookUrl: "",
  smtpHost: "",
  smtpPort: "",
  smtpUser: "",
  smtpPassword: "",
  smtpFromName: "",
  smtpFromEmail: "",
  smtpSecure: true,
};

function getNewConfigRequiredKeys(_cfg: NewConfig): (keyof NewConfig)[] {
  // Super-admin can save any time, with whatever they have so far.
  // Fields are validated for *format* when filled (see
  // validateNewConfigField), but none are required.
  return [];
}

function validateNewConfigField(field: keyof NewConfig, value: string): string {
  // Empty is always fine — fields are optional. Only validate the
  // *format* of values the user has typed something into.
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (["logoUrl", "receiptLogoUrl", "domainUrl", "webhookUrl"].includes(field)) {
    if (!/^https?:\/\//.test(trimmed)) return "Enter a valid URL";
  }
  if (field === "smtpFromEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address";
  }
  if (field === "smtpPort" && !/^\d+$/.test(trimmed)) {
    return "Enter a valid port number";
  }
  return "";
}

function getNewConfigValidationErrors(cfg: NewConfig): Partial<Record<keyof NewConfig, string>> {
  // Validate every key that has a typed value — catches bad URLs / emails
  // / ports even when the user didn't fill the form completely.
  const errs: Partial<Record<keyof NewConfig, string>> = {};
  (Object.keys(cfg) as (keyof NewConfig)[]).forEach((key) => {
    const value = cfg[key];
    if (typeof value !== "string") return;
    const err = validateNewConfigField(key, value);
    if (err) errs[key] = err;
  });
  return errs;
}

const FALLBACK_ENV_TYPE_OPTIONS: SelectMenuOption[] = [
  { value: "Production", label: "Production" },
  { value: "QA", label: "QA" },
  { value: "Development", label: "Development" },
];

const FALLBACK_GATEWAY_TYPE_OPTIONS: SelectMenuOption[] = [
  { value: "Razorpay", label: "Razorpay" },
  { value: "Cashfree", label: "Cashfree" },
];

// Fallback role list used until system_metadata loads (or if it returns nothing).
const BUILTIN_ADMIN_ROLES: SelectMenuOption[] = [
  { value: "admin", label: "Admin" },
  { value: "fin_admin", label: "Finance Admin" },
  { value: "ops_admin", label: "Operations Admin" },
];

/** SelectMenu inside `<dialog>` must not portal to `body` (top layer stacking). */
function ModalSelectMenu({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
  required,
  ariaLabel,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  error?: string;
  placeholder: string;
  required?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <SelectMenu
        aria-label={ariaLabel}
        value={value}
        emptyValue=""
        onChange={onChange}
        placeholder={placeholder}
        options={options}
        usePortal={false}
        className={
          "w-full min-w-0 " +
          (error ? "ring-2 ring-red-500/80 ring-offset-1 ring-offset-[var(--app-card-bg)]" : "")
        }
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TenantDetailsPageContent() {
  const { tenantId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const envMeta = useMetadata("environment_type", {
    fallback: FALLBACK_ENV_TYPE_OPTIONS.map((o, i) => ({
      value: o.value, label: o.label, displayOrder: i, isActive: true,
    })),
  });
  const gatewayMeta = useMetadata("payment_gateway", {
    fallback: FALLBACK_GATEWAY_TYPE_OPTIONS.map((o, i) => ({
      value: o.value, label: o.label, displayOrder: i, isActive: true,
    })),
  });
  const ENV_TYPE_OPTIONS: SelectMenuOption[] = envMeta.options.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const GATEWAY_TYPE_OPTIONS: SelectMenuOption[] = gatewayMeta.options.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  // Sandbox vs live for the configured gateway. Stored as 'test' or
  // 'production' on tenant_configurations.payment_mode.
  const PAYMENT_MODE_OPTIONS: SelectMenuOption[] = [
    { value: "test", label: "Test (sandbox)" },
    { value: "production", label: "Production (live)" },
  ];

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"details" | "configuration" | "admins">("details");

  // Config modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [newConfig, setNewConfig] = useState<NewConfig>(emptyConfig);
  const [newConfigErrors, setNewConfigErrors] = useState<Partial<Record<keyof NewConfig, string>>>({});
  const [showSecret, setShowSecret] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const [tenantConfigs, setTenantConfigs] = useState<SaveTenantConfigPayload[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsError, setConfigsError] = useState<string | null>(null);
  const [configDeleteBusy, setConfigDeleteBusy] = useState(false);

  const loadTenantConfigs = useCallback(async () => {
    if (!tenantId) return;
    setConfigsLoading(true);
    setConfigsError(null);
    try {
      const list = await getTenantConfigsByTenantIdApi(String(tenantId));
      setTenantConfigs(list);
    } catch (e) {
      setConfigsError(getApiErrorMessage(e, "Could not load saved configurations."));
    } finally {
      setConfigsLoading(false);
    }
  }, [tenantId]);

  const handleDeleteTenantConfig = useCallback(
    async (c: SaveTenantConfigPayload) => {
      if (configDeleteBusy) return;
      const recordId = getTenantConfigRecordId(c);
      if (!recordId) {
        setConfigsError("Cannot delete: configuration id is missing.");
        return;
      }
      setConfigDeleteBusy(true);
      setConfigsError(null);
      try {
        await deleteTenantConfigByIdApi(recordId);
        await loadTenantConfigs();
      } catch (e) {
        setConfigsError(getApiErrorMessage(e, "Could not delete configuration."));
      } finally {
        setConfigDeleteBusy(false);
      }
    },
    [configDeleteBusy, loadTenantConfigs]
  );

  // Add Admin modal state
  type NewAdmin = {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    password: string;
  };
  const emptyAdmin: NewAdmin = {
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    password: "",
  };
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState<NewAdmin>(emptyAdmin);
  const [adminErrors, setAdminErrors] = useState<Partial<Record<keyof NewAdmin, string>>>({});
  const [adminSuccess, setAdminSuccess] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState("");

  // Role options sourced from system_metadata(type=admin_role). Falls back to
  // the built-in list until the request resolves (or if it fails).
  const [roleOptions, setRoleOptions] = useState<SelectMenuOption[]>(BUILTIN_ADMIN_ROLES);
  useEffect(() => {
    let cancelled = false;
    listSystemMetadataApi({ type: "admin_role", activeOnly: true })
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : ((res as { data?: unknown })?.data as Array<Record<string, unknown>>) ?? [];
        const opts: SelectMenuOption[] = list
          .filter((r) => typeof r.value === "string" && r.value)
          .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
          .map((r) => ({
            value: String(r.value),
            label: String(r.label ?? r.value),
          }));
        if (!cancelled && opts.length > 0) setRoleOptions(opts);
      })
      .catch(() => {
        /* keep built-in fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateAdmin = (updates: Partial<NewAdmin>) =>
    setNewAdmin((prev) => ({ ...prev, ...updates }));

  const onAdminSubmit = async () => {
    const errs: Partial<Record<keyof NewAdmin, string>> = {};
    // password is optional; everything else is required
    const required: (keyof NewAdmin)[] = [
      "firstName",
      "lastName",
      "email",
      "role",
    ];
    required.forEach((key) => {
      if (!newAdmin[key].trim()) errs[key] = "This field is required";
    });
    if (newAdmin.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAdmin.email)) {
      errs.email = "Enter a valid email address";
    }
    if (newAdmin.password && newAdmin.password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }
    setAdminErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setAdminSaving(true);
    setAdminSaveError("");
    try {
      await saveAdmin({
        tenantId: String(tenantId),
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        role: newAdmin.role,
        ...(newAdmin.password ? { password: newAdmin.password } : {}),
      });
      setAdminSuccess("Admin added successfully!");
      window.setTimeout(() => {
        setAdminSuccess("");
        setAdminModalOpen(false);
        setNewAdmin(emptyAdmin);
        setAdminErrors({});
      }, 1500);
    } catch (err: unknown) {
      setAdminSaveError(err instanceof Error ? err.message : "Failed to save admin. Please try again.");
    } finally {
      setAdminSaving(false);
    }
  };

  const onAdminModalClose = () => {
    setAdminModalOpen(false);
    setNewAdmin(emptyAdmin);
    setAdminErrors({});
    setAdminSuccess("");
  };

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    getTenantById(String(tenantId))
      .then((data) => {
        if (cancelled) return;
        setTenant(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Tenant not found");
        setTenant(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  useEffect(() => {
    if (activeTab !== "configuration" || !tenantId) return;
    void loadTenantConfigs();
  }, [activeTab, tenantId, loadTenantConfigs]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "configuration" || tab === "admins" || tab === "details") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const visibleTenant = useMemo(() => tenant, [tenant]);

  const updateNew = (updates: Partial<NewConfig>) =>
    setNewConfig((prev) => ({ ...prev, ...updates }));

  const canSaveConfiguration = useMemo(
    () => Object.keys(getNewConfigValidationErrors(newConfig)).length === 0,
    [newConfig]
  );

  const onModalSubmit = async () => {
    const errs = getNewConfigValidationErrors(newConfig);
    setNewConfigErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      await saveTenantConfigApi({
        tenantId: String(tenantId ?? ""),
        envType: newConfig.envType,
        configName: newConfig.configName,
        logoUrl: newConfig.logoUrl,
        receiptLogoUrl: newConfig.receiptLogoUrl,
        domainUrl: newConfig.domainUrl,
        storageTab: newConfig.storageTab,
        accessKey: newConfig.accessKey,
        secretKey: newConfig.secretKey,
        bucketName: newConfig.bucketName,
        containerName: newConfig.containerName,
        gatewayType: newConfig.gatewayType,
        paymentKey: newConfig.paymentKey,
        paymentSecret: newConfig.paymentSecret,
        paymentMode: newConfig.paymentMode,
        webhookUrl: newConfig.webhookUrl,
        smtpHost: newConfig.smtpHost,
        smtpPort: newConfig.smtpPort,
        smtpUser: newConfig.smtpUser,
        smtpPassword: newConfig.smtpPassword,
        smtpFromName: newConfig.smtpFromName,
        smtpFromEmail: newConfig.smtpFromEmail,
        smtpSecure: newConfig.smtpSecure,
      });

      try {
        const list = await getTenantConfigsByTenantIdApi(String(tenantId ?? ""));
        setTenantConfigs(list);
      } catch {
        /* saved; list refresh is optional */
      }

      setModalSuccess("Configuration added successfully!");
      window.setTimeout(() => {
        setModalSuccess("");
        setModalOpen(false);
        setNewConfig(emptyConfig);
        setNewConfigErrors({});
      }, 1500);
    } catch (err) {
      setModalError(getApiErrorMessage(err, "Failed to save configuration. Please try again."));
    } finally {
      setModalSaving(false);
    }
  };

  const onModalClose = () => {
    setModalOpen(false);
    setNewConfig(emptyConfig);
    setNewConfigErrors({});
    setModalSuccess("");
    setModalError("");
    setShowSecret(false);
    setShowSmtpPassword(false);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-6 w-1/2 animate-pulse rounded-md bg-zinc-200" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-32 animate-pulse rounded-xl bg-zinc-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !visibleTenant) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-semibold text-red-700">Tenant not found</h2>
          <p className="mt-2 text-sm text-red-600">Please go back and select another tenant.</p>
          <Button onClick={() => router.push("/tenants")} className="mt-4" variant="secondary">
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs">
          <li>
            <button
              onClick={() => router.push("/tenants")}
              className="font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
            >
              Tenants
            </button>
          </li>
          <li>
            <svg className="h-3 w-3 text-[var(--app-text-muted)]" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </li>
          <li className="font-semibold text-[var(--app-text-primary)] truncate max-w-[280px]">
            {visibleTenant.name}
          </li>
        </ol>
      </nav>

      {/* Title row */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className="h-14 w-14 flex-shrink-0 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #6c739c 0%, #565c82 100%)" }}
          >
            {(visibleTenant.name || "?").split(" ").map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">
              {visibleTenant.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--app-text-secondary)]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold tabular-nums">
                {visibleTenant.tenantCode}
              </span>
              <span className="text-slate-300">·</span>
              <span>{visibleTenant.tenantName}</span>
            </div>
          </div>
        </div>

        {activeTab === "configuration" && (
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add configuration
          </Button>
        )}
        {activeTab === "admins" && (
          <Button variant="primary" size="md" onClick={() => setAdminModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add admin
          </Button>
        )}
      </header>

      {/* Premium tabs */}
      <div
        className="mb-6 flex gap-1 p-1 rounded-xl border bg-white"
        style={{ borderColor: "var(--app-card-border)" }}
      >
        {[
          { id: "details", label: "Details", icon: "info" },
          { id: "configuration", label: "Configuration", icon: "settings" },
          { id: "admins", label: "Admins", icon: "users" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "details" | "configuration" | "admins")}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: active ? "var(--app-brand-soft)" : "transparent",
                color: active ? "var(--app-brand)" : "var(--app-text-secondary)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {activeTab === "details" && <TenantDetailsTab tenant={visibleTenant} />}
        {activeTab === "configuration" && (
          <TenantConfigurationTab
            configs={tenantConfigs}
            loading={configsLoading}
            loadError={configsError}
            onRetry={loadTenantConfigs}
            onDeleteConfig={handleDeleteTenantConfig}
          />
        )}
       {activeTab === "admins" && <TenantAdminsTab tenantId={String(tenantId)} />}
      </div>

      {/* Add Configuration Modal */}
      <Modal
        open={modalOpen}
        onClose={onModalClose}
        title="Add Configuration"
        size="2xl"
        mobileFullscreen
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onModalClose}
              disabled={modalSaving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onModalSubmit}
              disabled={modalSaving || !canSaveConfiguration}
              isLoading={modalSaving}
              className="w-full sm:w-auto"
              title={!canSaveConfiguration && !modalSaving ? "Fix the highlighted field formats to save" : undefined}
            >
              Save Configuration
            </Button>
          </div>
        }
      >
        <form
          className="min-w-0 space-y-6"
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* General */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">
              General
            </legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ModalSelectMenu
                label="Environment Type"
                ariaLabel="Environment type"
                value={newConfig.envType}
                onChange={(v) => updateNew({ envType: v })}
                options={ENV_TYPE_OPTIONS}
                error={newConfigErrors.envType}
                placeholder="Select environment"
              />
              <Input
                label="Configuration Name"
                placeholder="e.g. Production Config"
                value={newConfig.configName}
                onChange={(e) => updateNew({ configName: e.target.value })}
                error={newConfigErrors.configName}
                fullWidth
              />
            </div>
          </fieldset>

          <div className="border-t border-[var(--app-divider)]" />

          {/* Domain Settings */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">
              Domain Settings
            </legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Input
                label="Logo URL"
                placeholder="https://example.com/logo.png"
                value={newConfig.logoUrl}
                onChange={(e) => updateNew({ logoUrl: e.target.value })}
                error={newConfigErrors.logoUrl}
                fullWidth
              />
              <Input
                label="Receipt Logo URL"
                placeholder="https://example.com/receipt-logo.png"
                value={newConfig.receiptLogoUrl}
                onChange={(e) => updateNew({ receiptLogoUrl: e.target.value })}
                error={newConfigErrors.receiptLogoUrl}
                fullWidth
              />
              <Input
                label="Domain URL"
                placeholder="https://app.example.com"
                value={newConfig.domainUrl}
                onChange={(e) => updateNew({ domainUrl: e.target.value })}
                error={newConfigErrors.domainUrl}
                fullWidth
                className="sm:col-span-2"
              />
            </div>
          </fieldset>

          <div className="border-t border-[var(--app-divider)]" />

          {/* File Storage */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">
              File Storage
            </legend>
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
              {(["accessKeys", "connectionString"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => updateNew({ storageTab: tab })}
                  className={`min-h-11 rounded-md px-3 py-2 text-center text-sm font-medium transition sm:min-h-0 ${
                    newConfig.storageTab === tab
                      ? "bg-foreground text-background"
                      : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                  }`}
                >
                  {tab === "accessKeys" ? "Access Keys" : "Connection String"}
                </button>
              ))}
            </div>

            {newConfig.storageTab === "accessKeys" && (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Input
                  label="Client ID / Access Key"
                  placeholder="Enter access key"
                  value={newConfig.accessKey}
                  onChange={(e) => updateNew({ accessKey: e.target.value })}
                  error={newConfigErrors.accessKey}
                  fullWidth
                />
                <div className="relative">
                  <Input
                    id="tenant-cfg-storage-secret"
                    label="Secret Key"
                    type={showSecret ? "text" : "password"}
                    placeholder="Enter secret key"
                    value={newConfig.secretKey}
                    onChange={(e) => updateNew({ secretKey: e.target.value })}
                    error={newConfigErrors.secretKey}
                    fullWidth
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    className="absolute right-2 top-8 text-sm text-[var(--app-text-secondary)]"
                  >
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  label="Bucket Name"
                  placeholder="e.g. my-storage-bucket"
                  value={newConfig.bucketName}
                  onChange={(e) => updateNew({ bucketName: e.target.value })}
                  error={newConfigErrors.bucketName}
                  fullWidth
                />
              </div>
            )}

            {newConfig.storageTab === "connectionString" && (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Input
                  label="Connection String"
                  placeholder="DefaultEndpointsProtocol=https;..."
                  value={newConfig.accessKey}
                  onChange={(e) => updateNew({ accessKey: e.target.value })}
                  error={newConfigErrors.accessKey}
                  fullWidth
                  className="sm:col-span-2"
                />
                <Input
                  label="Container Name"
                  placeholder="e.g. media-uploads"
                  value={newConfig.containerName}
                  onChange={(e) => updateNew({ containerName: e.target.value })}
                  error={newConfigErrors.containerName}
                  fullWidth
                />
              </div>
            )}
          </fieldset>

          <div className="border-t border-[var(--app-divider)]" />

          {/* Payment Gateway */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">
              Payment Gateway
            </legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ModalSelectMenu
                label="Gateway Type"
                ariaLabel="Payment gateway type"
                value={newConfig.gatewayType}
                onChange={(v) => updateNew({ gatewayType: v })}
                options={GATEWAY_TYPE_OPTIONS}
                error={newConfigErrors.gatewayType}
                placeholder="Select gateway"
              />
              <ModalSelectMenu
                label="Mode"
                ariaLabel="Payment gateway mode"
                value={newConfig.paymentMode}
                onChange={(v) => updateNew({ paymentMode: v })}
                options={PAYMENT_MODE_OPTIONS}
                error={newConfigErrors.paymentMode}
                placeholder="Test (sandbox)"
              />
              <Input
                label="Client ID / Key ID"
                placeholder="rzp_live_..."
                value={newConfig.paymentKey}
                onChange={(e) => updateNew({ paymentKey: e.target.value })}
                error={newConfigErrors.paymentKey}
                fullWidth
              />
              <div className="relative">
                <Input
                  id="tenant-cfg-payment-secret"
                  label="Payment Secret Key"
                  type={showSecret ? "text" : "password"}
                  placeholder="Enter payment secret"
                  value={newConfig.paymentSecret}
                  onChange={(e) => updateNew({ paymentSecret: e.target.value })}
                  error={newConfigErrors.paymentSecret}
                  fullWidth
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-2 top-8 text-sm text-[var(--app-text-secondary)]"
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                label="Webhook URL"
                placeholder="https://api.example.com/webhooks/payment"
                value={newConfig.webhookUrl}
                onChange={(e) => updateNew({ webhookUrl: e.target.value })}
                error={newConfigErrors.webhookUrl}
                fullWidth
              />
            </div>
          </fieldset>

          <div className="border-t border-[var(--app-divider)]" />

        
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">
              Email / SMTP Settings
            </legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Input
                label="SMTP Host"
                placeholder="e.g. smtp.gmail.com"
                value={newConfig.smtpHost}
                onChange={(e) => updateNew({ smtpHost: e.target.value })}
                error={newConfigErrors.smtpHost}
                fullWidth
              />
              <Input
                label="SMTP Port"
                placeholder="e.g. 587"
                value={newConfig.smtpPort}
                onChange={(e) => updateNew({ smtpPort: e.target.value })}
                error={newConfigErrors.smtpPort}
                fullWidth
              />
              <Input
                id="tenant-cfg-smtp-user"
                label="SMTP User"
                placeholder="e.g. noreply@example.com"
                value={newConfig.smtpUser}
                onChange={(e) => updateNew({ smtpUser: e.target.value })}
                error={newConfigErrors.smtpUser}
                fullWidth
                autoComplete="off"
              />
              <div className="relative">
                <Input
                  id="tenant-cfg-smtp-secret"
                  label="SMTP Password"
                  type={showSmtpPassword ? "text" : "password"}
                  placeholder="Enter SMTP password"
                  value={newConfig.smtpPassword}
                  onChange={(e) => updateNew({ smtpPassword: e.target.value })}
                  error={newConfigErrors.smtpPassword}
                  fullWidth
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword((s) => !s)}
                  className="absolute right-2 top-8 text-sm text-[var(--app-text-secondary)]"
                >
                  {showSmtpPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                label="From Name"
                placeholder="e.g. School Notifications"
                value={newConfig.smtpFromName}
                onChange={(e) => updateNew({ smtpFromName: e.target.value })}
                error={newConfigErrors.smtpFromName}
                fullWidth
              />
              <Input
                label="From Email"
                placeholder="e.g. noreply@school.com"
                value={newConfig.smtpFromEmail}
                onChange={(e) => updateNew({ smtpFromEmail: e.target.value })}
                error={newConfigErrors.smtpFromEmail}
                fullWidth
              />
              <div className="flex items-center gap-3 sm:col-span-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Use Secure Connection (TLS)
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={newConfig.smtpSecure}
                  onClick={() => updateNew({ smtpSecure: !newConfig.smtpSecure })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                    newConfig.smtpSecure ? "bg-foreground" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                      newConfig.smtpSecure ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </fieldset>

          {modalSuccess && (
            <p className="text-sm font-medium text-emerald-600">{modalSuccess}</p>
          )}
          {modalError && (
            <p className="text-sm font-medium text-red-600">{modalError}</p>
          )}
        </form>
      </Modal>

      {/* Add Admin Modal */}
      <Modal
        open={adminModalOpen}
        onClose={onAdminModalClose}
        title="Add Admin"
        size="lg"
        mobileFullscreen
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onAdminModalClose}
              disabled={adminSaving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onAdminSubmit}
              disabled={adminSaving}
              className="w-full sm:w-auto"
            >
              {adminSaving ? "Saving..." : "Add Admin"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Input
              label="First Name *"
              placeholder="e.g. Rajesh"
              value={newAdmin.firstName}
              onChange={(e) => updateAdmin({ firstName: e.target.value })}
              error={adminErrors.firstName}
              fullWidth
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Kumar"
              value={newAdmin.lastName}
              onChange={(e) => updateAdmin({ lastName: e.target.value })}
              error={adminErrors.lastName}
              fullWidth
            />
            <Input
              label="Email Address *"
              type="email"
              placeholder="admin@school.com"
              value={newAdmin.email}
              onChange={(e) => updateAdmin({ email: e.target.value })}
              error={adminErrors.email}
              fullWidth
            />
            <ModalSelectMenu
              label="Role"
              ariaLabel="Admin role"
              value={newAdmin.role}
              onChange={(v) => updateAdmin({ role: v })}
              options={roleOptions}
              error={adminErrors.role}
              placeholder="Select role"
              required
            />
            <Input
              label="Initial password (optional)"
              type="text"
              placeholder="Leave blank for system default"
              value={newAdmin.password}
              onChange={(e) => updateAdmin({ password: e.target.value })}
              error={adminErrors.password}
              fullWidth
            />
          </div>
          <p className="text-xs text-slate-500 -mt-3">
            Need a custom role? Add it under <span className="font-semibold">System Metadata → admin_role</span>{" "}
            and it will appear here.
          </p>

          {adminSuccess && (
            <p className="text-sm font-medium text-emerald-600">{adminSuccess}</p>
          )}
          {adminSaveError && (
            <p className="text-sm font-medium text-red-600">{adminSaveError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function TenantDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            <div className="h-8 w-1/3 animate-pulse rounded-md bg-zinc-200" />
            <div className="h-6 w-1/2 animate-pulse rounded-md bg-zinc-200" />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-32 animate-pulse rounded-xl bg-zinc-200" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <TenantDetailsPageContent />
    </Suspense>
  );
}

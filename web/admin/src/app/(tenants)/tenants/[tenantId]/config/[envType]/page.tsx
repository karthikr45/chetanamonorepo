"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ConfigSection } from "@/components/common";
import { Button, Input } from "@/components/ui";
import {
  getTenantConfigByIdApi,
  getTenantConfigsByTenantIdApi,
  getTenantConfigRecordId,
  saveTenantConfigApi,
  type SaveTenantConfigPayload,
  type TenantConfig as TenantConfigPayload,
} from "@/features/tenants/api/tenants.api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

/** Form model matches API config fields (tenant id is tracked separately on the page). */
type TenantConfigForm = Omit<TenantConfigPayload, "tenantId">;

function emptyTenantConfigForm(): TenantConfigForm {
  return {
    configName: "",
    logoUrl: "",
    receiptLogoUrl: "",
    domainUrl: "",
    privacyPolicyUrl: "",
    termsAndConditionsUrl: "",
    refundPolicyUrl: "",
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
    smtpSecure: false,
  };
}

function serverConfigToForm(row: SaveTenantConfigPayload): TenantConfigForm {
  const storageTab =
    row.storageTab === "connectionString" ? "connectionString" : "accessKeys";
  return {
    configName: row.configName ?? "",
    logoUrl: row.logoUrl ?? "",
    receiptLogoUrl: row.receiptLogoUrl ?? "",
    domainUrl: row.domainUrl ?? "",
    privacyPolicyUrl: row.privacyPolicyUrl ?? "",
    termsAndConditionsUrl: row.termsAndConditionsUrl ?? "",
    refundPolicyUrl: row.refundPolicyUrl ?? "",
    storageTab,
    accessKey: row.accessKey ?? "",
    secretKey: row.secretKey ?? "",
    bucketName: row.bucketName ?? "",
    containerName: row.containerName ?? "",
    gatewayType: row.gatewayType ?? "",
    paymentKey: row.paymentKey ?? "",
    paymentSecret: row.paymentSecret ?? "",
    paymentMode: row.paymentMode || "test",
    webhookUrl: row.webhookUrl ?? "",
    smtpHost: row.smtpHost ?? "",
    smtpPort: row.smtpPort ?? "",
    smtpUser: row.smtpUser ?? "",
    smtpPassword: row.smtpPassword ?? "",
    smtpFromName: row.smtpFromName ?? "",
    smtpFromEmail: row.smtpFromEmail ?? "",
    smtpSecure: Boolean(row.smtpSecure),
  };
}

export default function EnvConfigPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedTenantId = Array.isArray(tenantId) ? tenantId[0] : tenantId;
  const configIdFromQuery = searchParams.get("configId")?.trim() || undefined;

  const gatewayMeta = useMetadata("payment_gateway", {
    fallback: [
      { value: "Razorpay", label: "Razorpay", displayOrder: 1, isActive: true },
      { value: "Cashfree", label: "Cashfree", displayOrder: 2, isActive: true },
    ],
  });

  const goBackToTenantConfiguration = () => {
    if (resolvedTenantId) {
      router.push(`/tenants/${resolvedTenantId}?tab=configuration`);
      return;
    }
    router.push("/tenants");
  };

  const [config, setConfig] = useState<TenantConfigForm>(() => emptyTenantConfigForm());
  const [configRecordId, setConfigRecordId] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Partial<Record<keyof TenantConfigForm, string>>>({});
  const [showSuccess, setShowSuccess] = useState("");
  const [showError, setShowError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tid = String(resolvedTenantId ?? "").trim();
    if (!tid) {
      setConfigLoading(false);
      setConfigLoadError("Missing tenant id.");
      return () => {
        cancelled = true;
      };
    }

    setConfigLoading(true);
    setConfigLoadError(null);

    (async () => {
      const fallbackForm = emptyTenantConfigForm();

      try {
        let row: SaveTenantConfigPayload | null = null;

        if (configIdFromQuery) {
          try {
            row = await getTenantConfigByIdApi(configIdFromQuery);
          } catch {
            /* e.g. 404 — resolve from tenant list below */
          }
        }

        if (!row) {
          // Single config per tenant — take it (matching the id when present).
          const list = await getTenantConfigsByTenantIdApi(tid);
          row =
            (configIdFromQuery
              ? list.find((r) => getTenantConfigRecordId(r) === configIdFromQuery)
              : undefined) ??
            list[0] ??
            null;
        }

        if (cancelled) return;

        if (row) {
          setConfigRecordId(getTenantConfigRecordId(row));
          setConfig(serverConfigToForm(row));
        } else {
          setConfigRecordId(undefined);
          setConfig(fallbackForm);
        }
      } catch (e) {
        if (!cancelled) {
          setConfigLoadError(getApiErrorMessage(e, "Could not load configuration."));
          setConfigRecordId(undefined);
          setConfig(fallbackForm);
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedTenantId, configIdFromQuery]);

  const updateConfig = (updates: Partial<TenantConfigForm>) =>
    setConfig((prev) => ({ ...prev, ...updates }));

  const validateInput = (field: keyof TenantConfigForm, value: string) => {
    // All fields are optional — super-admin can save partial configs
    // and come back to fill the rest later. Format checks still run
    // when the user *has* typed something into a field.
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (
      [
        "logoUrl",
        "receiptLogoUrl",
        "domainUrl",
        "webhookUrl",
        "privacyPolicyUrl",
        "termsAndConditionsUrl",
        "refundPolicyUrl",
      ].includes(field)
    ) {
      if (!/^https?:\/\//.test(trimmed)) return "Enter a valid URL";
    }
    if (field === "smtpFromEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Enter a valid email address";
    }
    if (field === "smtpPort" && !/^\d+$/.test(trimmed)) {
      return "Enter a valid port number";
    }
    return "";
  };

  const onSubmit = async () => {
    const baseKeys: (keyof TenantConfigForm)[] = [
      "configName",
      "logoUrl",
      "receiptLogoUrl",
      "domainUrl",
      "privacyPolicyUrl",
      "termsAndConditionsUrl",
      "refundPolicyUrl",
      "gatewayType",
      "paymentKey",
      "paymentSecret",
      "webhookUrl",
    ];
    const storageKeys: (keyof TenantConfigForm)[] =
      config.storageTab === "connectionString"
        ? ["accessKey", "containerName"]
        : ["accessKey", "secretKey", "bucketName"];
    const keysToValidate = [...baseKeys, ...storageKeys];

    const nextErrors: Partial<Record<keyof TenantConfigForm, string>> = {};
    keysToValidate.forEach((key) => {
      const error = validateInput(key, config[key] as string);
      if (error) nextErrors[key] = error;
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    setShowError("");
    setShowSuccess("");

    const payload: SaveTenantConfigPayload = {
      tenantId: String(resolvedTenantId ?? ""),
      configName: config.configName,
      logoUrl: config.logoUrl,
      receiptLogoUrl: config.receiptLogoUrl,
      domainUrl: config.domainUrl,
      privacyPolicyUrl: config.privacyPolicyUrl,
      termsAndConditionsUrl: config.termsAndConditionsUrl,
      refundPolicyUrl: config.refundPolicyUrl,
      storageTab: config.storageTab,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      bucketName: config.bucketName,
      containerName: config.containerName,
      gatewayType: config.gatewayType,
      paymentKey: config.paymentKey,
      paymentSecret: config.paymentSecret,
      paymentMode: config.paymentMode,
      webhookUrl: config.webhookUrl,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      smtpPassword: config.smtpPassword,
      smtpFromName: config.smtpFromName,
      smtpFromEmail: config.smtpFromEmail,
      smtpSecure: config.smtpSecure,
    };
    try {
      await saveTenantConfigApi(payload);
      try {
        const tid = String(resolvedTenantId ?? "");
        if (configRecordId) {
          const refreshed = await getTenantConfigByIdApi(configRecordId);
          if (refreshed) setConfig(serverConfigToForm(refreshed));
        } else {
          const list = await getTenantConfigsByTenantIdApi(tid);
          const match = list[0];
          if (match) {
            setConfigRecordId(getTenantConfigRecordId(match));
            setConfig(serverConfigToForm(match));
          }
        }
      } catch {
        /* save succeeded; form refresh is optional */
      }
      const tid = String(resolvedTenantId ?? "").trim();
      if (tid) {
        router.push(`/tenants/${encodeURIComponent(tid)}?tab=configuration`);
        return;
      }
      setShowSuccess("Configuration saved successfully");
      window.setTimeout(() => setShowSuccess(""), 3000);
    } catch (error) {
      setShowError(getApiErrorMessage(error, "Failed to save configuration. Please try again."));
      window.setTimeout(() => setShowError(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const isEditingConfig = Boolean(configRecordId || configIdFromQuery);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={goBackToTenantConfiguration}
            variant="outline"
            size="sm"
            type="button"
            className="shrink-0"
          >
            ← 
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">
              Configuration
            </h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
              Manage settings for this tenant
            </p>
          </div>
        </div>
      </div>

      {configLoading && (
        <p className="mb-4 text-sm text-[var(--app-text-secondary)]">Loading configuration…</p>
      )}
      {configLoadError && !configLoading && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {configLoadError} You can edit the fields below and save, or go back and retry.
        </div>
      )}

      <form
        className={`space-y-4 ${configLoading ? "pointer-events-none opacity-60" : ""}`}
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <ConfigSection title="General">
          <Input
            label="Configuration Name"
            value={config.configName}
            onChange={(e) => updateConfig({ configName: e.target.value })}
            error={errors.configName}
            fullWidth
          />
        </ConfigSection>

        <ConfigSection title="Domain Settings">
          <Input
            label="Logo URL"
            value={config.logoUrl}
            onChange={(e) => updateConfig({ logoUrl: e.target.value })}
            error={errors.logoUrl}
            fullWidth
          />
          <Input
            label="Receipt Logo URL"
            value={config.receiptLogoUrl}
            onChange={(e) => updateConfig({ receiptLogoUrl: e.target.value })}
            error={errors.receiptLogoUrl}
            fullWidth
          />
          <Input
            label="Domain URL"
            value={config.domainUrl}
            onChange={(e) => updateConfig({ domainUrl: e.target.value })}
            error={errors.domainUrl}
            fullWidth
          />
        </ConfigSection>

        <ConfigSection title="Legal / Policy URLs">
          <Input
            label="Privacy Policy URL"
            placeholder="https://example.com/privacy"
            value={config.privacyPolicyUrl}
            onChange={(e) => updateConfig({ privacyPolicyUrl: e.target.value })}
            error={errors.privacyPolicyUrl}
            fullWidth
          />
          <Input
            label="Terms & Conditions URL"
            placeholder="https://example.com/terms"
            value={config.termsAndConditionsUrl}
            onChange={(e) => updateConfig({ termsAndConditionsUrl: e.target.value })}
            error={errors.termsAndConditionsUrl}
            fullWidth
          />
          <Input
            label="Refund Policy URL"
            placeholder="https://example.com/refund"
            value={config.refundPolicyUrl}
            onChange={(e) => updateConfig({ refundPolicyUrl: e.target.value })}
            error={errors.refundPolicyUrl}
            fullWidth
          />
        </ConfigSection>

        <ConfigSection title="File Storage">
          <div className="sm:col-span-2">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm transition ${config.storageTab === "accessKeys" ? "bg-foreground text-background" : "border border-zinc-300 bg-white"}`}
                onClick={() => updateConfig({ storageTab: "accessKeys" })}
              >
                Access Keys
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm transition ${config.storageTab === "connectionString" ? "bg-foreground text-background" : "border border-zinc-300 bg-white"}`}
                onClick={() => updateConfig({ storageTab: "connectionString" })}
              >
                Connection String
              </button>
            </div>
          </div>

          {(config.storageTab === "accessKeys" || !config.storageTab) && (
            <>
              <Input
                label="Client ID / Access Key"
                value={config.accessKey}
                onChange={(e) => updateConfig({ accessKey: e.target.value })}
                error={errors.accessKey}
                fullWidth
              />
              <div className="relative">
                <Input
                  id="tenant-cfg-storage-secret"
                  label="Secret Key"
                  type={showSecret ? "text" : "password"}
                  value={config.secretKey}
                  onChange={(e) => updateConfig({ secretKey: e.target.value })}
                  error={errors.secretKey}
                  fullWidth
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-8 text-sm text-[var(--app-text-secondary)]"
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                label="Bucket Name"
                value={config.bucketName}
                onChange={(e) => updateConfig({ bucketName: e.target.value })}
                error={errors.bucketName}
                fullWidth
              />
            </>
          )}

          {config.storageTab === "connectionString" && (
            <>
              <Input
                label="Connection String"
                value={config.accessKey}
                onChange={(e) => updateConfig({ accessKey: e.target.value })}
                error={errors.accessKey}
                fullWidth
              />
              <Input
                label="Container Name"
                placeholder="e.g. media-uploads"
                value={config.containerName}
                onChange={(e) => updateConfig({ containerName: e.target.value })}
                error={errors.containerName}
                fullWidth
              />
            </>
          )}
        </ConfigSection>

        <ConfigSection title="Payment Gateway">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--app-text-secondary)]">
              Gateway Type
            </label>
            <select
              value={config.gatewayType}
              onChange={(e) => updateConfig({ gatewayType: e.target.value })}
              className={`h-11 rounded-lg border px-3 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
                errors.gatewayType ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300"
              }`}
            >
              <option value="">Select gateway</option>
              {gatewayMeta.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.gatewayType && <p className="text-sm text-red-600">{errors.gatewayType}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--app-text-secondary)]">
              Mode
            </label>
            <select
              value={config.paymentMode}
              onChange={(e) => updateConfig({ paymentMode: e.target.value })}
              className="h-11 rounded-lg border border-zinc-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="test">Test (sandbox)</option>
              <option value="production">Production (live)</option>
            </select>
          </div>

          <Input
            label="Client ID / Key ID"
            value={config.paymentKey}
            onChange={(e) => updateConfig({ paymentKey: e.target.value })}
            error={errors.paymentKey}
            fullWidth
          />
          <div className="relative">
            <Input
              id="tenant-cfg-payment-secret"
              label="Secret Key"
              type={showSecret ? "text" : "password"}
              value={config.paymentSecret}
              onChange={(e) => updateConfig({ paymentSecret: e.target.value })}
              error={errors.paymentSecret}
              fullWidth
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-8 text-sm text-[var(--app-text-secondary)]"
            >
              {showSecret ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            label="Webhook URL"
            value={config.webhookUrl}
            onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
            error={errors.webhookUrl}
            fullWidth
          />
        </ConfigSection>

        <ConfigSection title="Email / SMTP Settings">
          <Input
            label="SMTP Host"
            placeholder="e.g. smtp.gmail.com"
            value={config.smtpHost}
            onChange={(e) => updateConfig({ smtpHost: e.target.value })}
            error={errors.smtpHost}
            fullWidth
          />
          <Input
            label="SMTP Port"
            placeholder="e.g. 587"
            value={config.smtpPort}
            onChange={(e) => updateConfig({ smtpPort: e.target.value })}
            error={errors.smtpPort}
            fullWidth
          />
          <Input
            id="tenant-cfg-smtp-user"
            label="SMTP User"
            placeholder="e.g. noreply@example.com"
            value={config.smtpUser}
            onChange={(e) => updateConfig({ smtpUser: e.target.value })}
            error={errors.smtpUser}
            fullWidth
            autoComplete="off"
          />
          <div className="relative">
            <Input
              id="tenant-cfg-smtp-secret"
              label="SMTP Password"
              type={showSmtpPassword ? "text" : "password"}
              placeholder="Enter SMTP password"
              value={config.smtpPassword}
              onChange={(e) => updateConfig({ smtpPassword: e.target.value })}
              error={errors.smtpPassword}
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
            value={config.smtpFromName}
            onChange={(e) => updateConfig({ smtpFromName: e.target.value })}
            error={errors.smtpFromName}
            fullWidth
          />
          <Input
            label="From Email"
            placeholder="e.g. noreply@school.com"
            value={config.smtpFromEmail}
            onChange={(e) => updateConfig({ smtpFromEmail: e.target.value })}
            error={errors.smtpFromEmail}
            fullWidth
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="text-sm font-medium text-[var(--app-text-secondary)]">
              Use Secure Connection (TLS)
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={config.smtpSecure}
              onClick={() => updateConfig({ smtpSecure: !config.smtpSecure })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                config.smtpSecure ? "bg-foreground" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                  config.smtpSecure ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </ConfigSection>

        {showSuccess && <div className="mt-4 text-sm text-emerald-600">{showSuccess}</div>}
        {showError && <div className="mt-4 text-sm text-red-600">{showError}</div>}

        <div className="sticky bottom-0 z-20 mt-6 rounded-md bg-[var(--app-card-bg)] py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onSubmit} disabled={saving} fullWidth className="sm:w-auto">
              {saving ? "Saving…" : isEditingConfig ? "Update Configuration" : "Save Configuration"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

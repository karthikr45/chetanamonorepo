"use client";

import { useState } from "react";
import { TenantCardHeader } from "@/components/common";
import { TenantCard } from "@/components/common/TenantCard/TenantCard";
import { Modal } from "@/components/common/Modal";
import {
  getTenantConfigRecordId,
  type SaveTenantConfigPayload,
} from "@/features/tenants/api/tenants.api";
import { Button } from "@/components/ui/Button";
import { useParams, useRouter } from "next/navigation";

type DeleteDialogState =
  | { open: false }
  | { open: true; mode: "confirm"; config: SaveTenantConfigPayload }
  | { open: true; mode: "noId" };

function pickConfigString(c: SaveTenantConfigPayload, keys: string[]): string {
  const r = c as unknown as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function savedConfigCardTitle(c: SaveTenantConfigPayload): string {
  return (
    pickConfigString(c, ["configName", "config_name", "name", "configurationName", "title"]) ||
    "Configuration"
  );
}

type TenantConfigurationTabProps = {
  configs: SaveTenantConfigPayload[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onDeleteConfig: (config: SaveTenantConfigPayload) => void | Promise<void>;
};

export default function TenantConfigurationTab({
  configs,
  loading,
  loadError,
  onRetry,
  onDeleteConfig,
}: TenantConfigurationTabProps) {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false });

  const closeDeleteDialog = () => setDeleteDialog({ open: false });

  const openConfigEditor = (c: SaveTenantConfigPayload) => {
    const recordId = getTenantConfigRecordId(c);
    const path = `/tenants/${tenantId}/config/default`;
    router.push(recordId ? `${path}?configId=${encodeURIComponent(recordId)}` : path);
  };

  function handleDeleteConfig(c: SaveTenantConfigPayload): void {
    const recordId = getTenantConfigRecordId(c);
    if (!recordId) {
      setDeleteDialog({ open: true, mode: "noId" });
      return;
    }
    setDeleteDialog({ open: true, mode: "confirm", config: c });
  }

  function confirmDelete(): void {
    if (!deleteDialog.open || deleteDialog.mode !== "confirm") return;
    const cfg = deleteDialog.config;
    closeDeleteDialog();
    void onDeleteConfig(cfg);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-text-primary)]">
              Configuration
            </h2>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
              Storage, payment gateway and SMTP credentials for this tenant.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void onRetry()}>
              Retry
            </Button>
          </div>
        )}
        {loading && !loadError && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-[var(--app-card-radius)] border bg-white animate-pulse"
                style={{ borderColor: "var(--app-card-border)" }}
              />
            ))}
          </div>
        )}
        {!loading && !loadError && configs.length === 0 && (
          <div
            className="rounded-[var(--app-card-radius)] border border-dashed border-slate-300 bg-white/50 px-6 py-14 text-center"
          >
            <div
              className="mx-auto mb-3 h-12 w-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--app-brand-soft)", color: "var(--app-brand)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
              No configuration yet
            </h3>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)] max-w-sm mx-auto">
              Click <span className="font-semibold">Add configuration</span> above to set up this tenant.
            </p>
          </div>
        )}
        {!loading && configs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {configs.map((c, idx) => {
              return (
                <TenantCard
                  key={getTenantConfigRecordId(c) ?? `${savedConfigCardTitle(c)}-${idx}`}
                  isSelected={false}
                  onClick={() => openConfigEditor(c)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold tracking-tight text-[var(--app-text-primary)]">
                        {savedConfigCardTitle(c)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                        Click to edit credentials
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openConfigEditor(c); }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:bg-slate-100 hover:text-[var(--app-text-primary)]"
                        aria-label="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConfig(c); }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </TenantCard>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={deleteDialog.open}
        onClose={closeDeleteDialog}
        title={deleteDialog.open && deleteDialog.mode === "noId" ? "Cannot delete" : "Delete configuration?"}
        size="sm"
        footer={
          deleteDialog.open && deleteDialog.mode === "noId" ? (
            <Button type="button" variant="primary" size="sm" onClick={closeDeleteDialog}>
              OK
            </Button>
          ) : deleteDialog.open && deleteDialog.mode === "confirm" ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </Button>
            </>
          ) : null
        }
      >
        {deleteDialog.open && deleteDialog.mode === "noId" && (
          <p className="text-sm text-[var(--app-text-secondary)]">
            This configuration has no id from the server, so it cannot be deleted. If the problem continues,
            refresh the page or contact support.
          </p>
        )}
        {deleteDialog.open && deleteDialog.mode === "confirm" && (
          <p className="text-sm text-[var(--app-text-secondary)]">
            <span className="font-medium text-[var(--app-text-primary)]">{savedConfigCardTitle(deleteDialog.config)}</span>
            {" will be removed. This cannot be undone."}
          </p>
        )}
      </Modal>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFetchTemplates } from "@/features/templates";
import type { Template } from "@/features/templates";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";

type TabId = "approved" | "rejected";

const TABS: { id: TabId; label: string }[] = [
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: Template["status"] }) {
  const isApproved = status === "approved";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isApproved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isApproved ? "bg-emerald-500" : "bg-red-500"}`}
      />
      {isApproved ? "Approved" : "Rejected"}
    </span>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <div
      className="group relative flex flex-col rounded-[var(--app-card-radius)] border bg-white p-5 transition-all hover:shadow-[var(--app-card-shadow-hover)] hover:-translate-y-0.5"
      style={{
        borderColor: "var(--app-card-border)",
        boxShadow: "var(--app-card-shadow)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-[var(--app-text-primary)]">
            {template.name}
          </h3>
          {(template.category || template.language) && (
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
              {[template.category, template.language].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <StatusBadge status={template.status} />
      </div>
      <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
        <p className="text-xs text-[var(--app-text-muted)]">
          Created {formatDate(template.createdAt)}
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
        >
          View details →
        </button>
      </div>
    </div>
  );
}

export function TemplatesPageContent() {
  const { data: templates, loading, error } = useFetchTemplates();
  const [activeTab, setActiveTab] = useState<TabId>("approved");
  const router = useRouter();

  const visible = templates.filter((t) => t.status === "approved" || t.status === "rejected");
  const filtered = visible.filter((t) => t.status === activeTab);
  const countFor = (id: TabId) => visible.filter((t) => t.status === id).length;

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="WhatsApp / SMS / email templates used to notify parents and students. Approved templates are sent automatically."
        meta={
          !loading && (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 tabular-nums">
              {visible.length}
            </span>
          )
        }
        actions={
          <Button variant="primary" size="md" onClick={() => router.push("/templates/save-template")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New template
          </Button>
        }
      />

      {/* Tabs */}
      <div
        className="mb-5 inline-flex items-center gap-1 rounded-xl border p-1 bg-white"
        style={{ borderColor: "var(--app-card-border)" }}
      >
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="relative flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all"
              style={{
                backgroundColor: active ? "var(--app-brand-soft)" : "transparent",
                color: active ? "var(--app-brand)" : "var(--app-text-secondary)",
              }}
            >
              {label}
              {!loading && (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                  style={{
                    backgroundColor: active ? "var(--app-brand)" : "var(--app-divider)",
                    color: active ? "#fff" : "var(--app-text-secondary)",
                  }}
                >
                  {countFor(id)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border p-4"
              style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
            >
              <div className="mb-3 h-4 w-3/4 rounded" style={{ backgroundColor: "var(--app-divider)" }} />
              <div className="mb-4 h-3 w-1/2 rounded" style={{ backgroundColor: "var(--app-divider)" }} />
              <div className="h-3 w-1/3 rounded" style={{ backgroundColor: "var(--app-divider)" }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-16 sm:py-20"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
        >
          <svg
            className="mb-3 h-10 w-10 sm:h-12 sm:w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            style={{ color: "var(--app-text-secondary)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--app-text-secondary)" }}>
            No {activeTab} templates found
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}

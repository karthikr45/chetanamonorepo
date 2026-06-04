"use client";

import { useEffect, useState } from "react";
import { getAdmins } from "@/features/admins/services/admins.service";
import type { Admin } from "@/features/admins/api/admins.api";

const roleBadgeColor: Record<string, string> = {
  "super_admin": "bg-purple-100 text-purple-700",
  "admin": "bg-[#f0dad5] text-[#565c82]",
  "Principal": "bg-emerald-100 text-emerald-700",
  "Operations Admin": "bg-amber-100 text-amber-700",
  "IT Admin": "bg-zinc-100 text-zinc-700",
  // "admin": "bg-zinc-100 text-zinc-700",
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: "var(--app-brand)" }}
    >
      {initials}
    </div>
  );
}

export default function TenantAdminsTab({ tenantId }: { tenantId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdmins(tenantId)
      .then((data) => {
        if (cancelled) return;
        setAdmins(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load admins. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-[var(--app-card-radius)] border bg-white"
        style={{ borderColor: "var(--app-card-border)", boxShadow: "var(--app-card-shadow)" }}
      >
        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, i) => (
                <tr
                  key={admin.id}
                  className={`hover:bg-slate-50 transition-colors ${i !== admins.length - 1 ? "border-b border-slate-50" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${admin.firstName} ${admin.lastName}`} />
                      <span className="font-semibold text-[var(--app-text-primary)]">
                        {admin.firstName} {admin.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                    {admin.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        roleBadgeColor[admin.role] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      {admin.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[var(--app-divider)] sm:hidden">
          {admins.map((admin) => (
            <div key={admin.id} className="px-4 py-4 space-y-2">
              <div className="flex items-center gap-3">
                <Avatar name={`${admin.firstName} ${admin.lastName}`} />
                <div>
                  <p className="font-medium text-[var(--app-text-primary)]">
                    {admin.firstName} {admin.lastName}
                  </p>
                  <p className="text-xs text-[var(--app-text-secondary)]">{admin.email}</p>
                </div>
              </div>
              <div className="pl-12">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    roleBadgeColor[admin.role] ?? "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {admin.role}
                </span>
              </div>
            </div>
          ))}
        </div>

        {admins.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--app-text-secondary)]">
            No admins found. Click &quot;Add Admin&quot; to get started.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  deleteTemplateApi,
  listTemplatesApi,
  type ReceiptTemplate,
} from "@/features/receipt-templates/api/receipt-templates.api";

const KIND_LABEL: Record<string, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  BOTH: "Online + Offline",
};

export function ReceiptTemplatesListContent() {
  const [rows, setRows] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listTemplatesApi());
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load templates"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await deleteTemplateApi(id);
      load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not delete"));
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1100px] mx-auto">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Receipt templates
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Define the header, body, and footer of the receipts your school
            issues. Mark one as default — it will be used automatically for
            future payments. You can keep separate templates for online and
            offline payments.
          </p>
        </div>
        <Link href="/settings/receipt-templates/new">
          <Button variant="primary">+ New template</Button>
        </Link>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">
            No templates yet. Click <strong>+ New template</strong> to create one.
            Until then, receipts use the built-in default layout.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Name</Th>
                <Th>Applies to</Th>
                <Th>Default</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}
                >
                  <td className="px-5 py-3 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-5 py-3 text-slate-600">{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td className="px-5 py-3">
                    {r.isDefault && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f7ece9] text-[#6c739c]">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 tabular-nums">
                    {new Date(r.updatedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <Link
                      href={`/settings/receipt-templates/${r.id}`}
                      className="text-xs font-semibold text-[#6c739c] hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => remove(r.id, r.name)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Need to print one off manually?{" "}
        <Link
          href="/settings/receipt-templates/generate"
          className="text-[#6c739c] font-semibold hover:underline"
        >
          Generate a receipt →
        </Link>
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { getApiBaseUrl } from "@/lib/env";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import { useAuth } from "@/features/auth";
import { AddStudentModal } from "./AddStudentModal";

interface Props {
  onUpload: () => void;
  /** Triggers a re-fetch on the listing below after a successful create. */
  onCreated?: () => void;
}

/**
 * Toolbar above the Students table (legacy view).
 * - Excel template (.xlsx)  — download with sample rows + Instructions sheet
 * - CSV template (.csv)     — flat alternate format
 * - Upload Excel            — switches the page tab to upload flow
 * - Add student             — opens the single-student form modal
 */
export function StudentsActionBar({ onUpload, onCreated }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const { user } = useAuth();

  // Branch defaults to the JWT's school code. AY options + default
  // are owned by the modal (it reads them from system_metadata).
  const defaultBranch = user?.branch ?? "";

  async function downloadTemplate(format: "xlsx" | "csv") {
    try {
      const url = `${getApiBaseUrl()}/students/upload/template?format=${format}`;
      const token = getStoredToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const filename = `svbk-students-upload-template.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(getApiErrorMessage(err, "Could not download template"));
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      <div
        className="inline-flex rounded-lg overflow-hidden border bg-white shadow-sm"
        style={{ borderColor: "var(--app-card-border)" }}
      >
        <button
          type="button"
          onClick={() => downloadTemplate("xlsx")}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Download Excel template (with samples + Instructions sheet)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
          </svg>
          Excel template
        </button>
        <button
          type="button"
          onClick={() => downloadTemplate("csv")}
          className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-l transition-colors cursor-pointer"
          style={{ borderColor: "var(--app-card-border)" }}
          title="Download CSV template instead"
        >
          CSV
        </button>
      </div>

      <Button variant="outline" size="md" onClick={onUpload} className="cursor-pointer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Upload Excel
      </Button>

      <Button variant="primary" size="md" onClick={() => setAddOpen(true)} className="cursor-pointer">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Add student
      </Button>

      <AddStudentModal
        open={addOpen}
        defaultBranch={defaultBranch}
        onClose={() => setAddOpen(false)}
        onCreated={() => onCreated?.()}
      />
    </div>
  );
}

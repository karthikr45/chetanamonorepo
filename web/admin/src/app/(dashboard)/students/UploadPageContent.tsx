"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import {
  DataTableCard,
  TablePagination,
  type PaginationInfo,
} from "@/components/dashboard";
import * as XLSX from "xlsx";
import { checkTermDetails, uploadStudentData } from "@/features/students/services/students.service";
type UploadValidationRow = Record<string, string>;
type UploadRowData = Record<string, unknown>;

type BackendValidationRow = {
  rowNumber?: number;
  status?: string;
  message?: string;
  isTermExists?: boolean;
  data?: UploadRowData;
} & UploadRowData;

type BackendValidationEnvelope = {
  success?: boolean;
  data?: {
    totalRows?: number;
    validCount?: number;
    errorCount?: number;
    rows?: BackendValidationRow[];
  };
  message?: string;
};

const PAGE_SIZE = 10;

type ParsedData = {
  headers: string[];
  rows: string[][];
  fileName: string;
  fileSize: number;
};

type UploadPageContentProps = {
  onBack?: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const [headers = [], ...rows] = json;
        const nonEmpty = rows.filter((r) => r.some((cell) => cell !== undefined && cell !== ""));
        resolve({
          headers: headers.map(String),
          rows: nonEmpty.map((r) => headers.map((_, i) => r[i] != null ? String(r[i]) : "")),
          fileName: file.name,
          fileSize: file.size,
        });
      } catch {
        reject(new Error(`Failed to parse ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function extractValidationRows(payload: unknown): BackendValidationRow[] {
  if (Array.isArray(payload)) return payload as BackendValidationRow[];
  if (payload && typeof payload === "object") {
    const envelope = payload as BackendValidationEnvelope;
    if (Array.isArray(envelope?.data?.rows)) return envelope.data.rows;
    if (Array.isArray((payload as { rows?: unknown }).rows)) {
      return (payload as { rows: BackendValidationRow[] }).rows;
    }
  }
  return [];
}

function isErrorRow(row: BackendValidationRow): boolean {
  const status = String(row.status ?? "").trim().toUpperCase();
  if (status === "ERROR") return true;
  const message = String(row.message ?? "").trim();
  return Boolean(message && message !== "Details are Valid");
}

function detectErrorColumn(message: string, headers: string[]): string | null {
  const normalizedMessage = message.toLowerCase();
  const sortedHeaders = [...headers].sort((a, b) => b.length - a.length);
  const directMatch = sortedHeaders.find((header) => normalizedMessage.includes(header.toLowerCase()));
  if (directMatch) return directMatch;

  const alreadyExistsMatch = message.match(/^(.+?)\s+already exists/i);
  if (!alreadyExistsMatch) return null;
  const candidate = alreadyExistsMatch[1].trim().toLowerCase();
  return headers.find((header) => header.toLowerCase() === candidate) ?? null;
}

function isExcludedHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase().replace(/\s+/g, "");
  return normalized === "imgurl" || normalized === "imageurl" || normalized === "message";
}

export function UploadPageContent({ onBack }: UploadPageContentProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<BackendValidationRow[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setParsing(true);
    setParseError(null);
    setParsed(null);
    setCurrentPage(1);
    setValidatedRows(null);
    setValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) {
        setParseError("The file has no data rows.");
      } else {
        setParsed(result);
        // Validate immediately after upload
        setValidating(true);
        setValidationError(null);
        try {
          const validateRes = await checkTermDetails(file);
          setValidatedRows(extractValidationRows(validateRes));
        } catch (err: unknown) {
          setValidationError(err instanceof Error ? err.message : "Failed to validate file");
          setValidatedRows(null);
        } finally {
          setValidating(false);
        }
      }
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    handleFile(incoming[0]);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsed(null);
    setParseError(null);
    setValidatedRows(null);
    setValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    setValidating(true);
    setValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const result = await checkTermDetails(selectedFile);
      setValidatedRows(extractValidationRows(result));
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Failed to validate file");
    } finally {
      setValidating(false);
    }
  };

  const hasRowErrors = useMemo(() => {
    if (!validatedRows || validatedRows.length === 0) return true;
    return validatedRows.some((row) => isErrorRow(row));
  }, [validatedRows]);

  const handleSubmit = async () => {
    if (!selectedFile) return;
    if (!validatedRows) return; // must validate first
    if (hasRowErrors) return; // fix errors first
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const submitResult = await uploadStudentData(selectedFile);
      const submitRows = extractValidationRows(submitResult);
      if (submitRows.length > 0) {
        setValidatedRows(submitRows);
      }
      const hasSubmitErrors = submitRows.some((row) => isErrorRow(row));
      if (hasSubmitErrors) {
        setSubmitError("Some rows failed. Hover red rows to see the message.");
      } else {
        // The confirm endpoint returns a summary ({ message, counts… }) —
        // surface it so admins see how many fees were created vs revised.
        const summaryMessage =
          submitResult &&
          typeof submitResult === "object" &&
          typeof (submitResult as { message?: unknown }).message === "string"
            ? (submitResult as { message: string }).message
            : "Student data uploaded successfully.";
        setSubmitSuccess(summaryMessage);
        onBack?.();
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to upload student data");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCount = validatedRows?.length ?? parsed?.rows.length ?? 0;
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1;
  const pageIndex = Math.min(currentPage, totalPages);
  const start = (pageIndex - 1) * PAGE_SIZE;
  const pageRows = parsed ? parsed.rows.slice(start, start + PAGE_SIZE) : [];
  const pageValidated = validatedRows ? validatedRows.slice(start, start + PAGE_SIZE) : null;
  const visibleHeaders = useMemo(
    () => (parsed ? parsed.headers.filter((header) => !isExcludedHeader(header)) : []),
    [parsed]
  );

  const paginationInfo: PaginationInfo = useMemo(
    () => ({
      from: totalCount > 0 ? start + 1 : 0,
      to: Math.min(start + PAGE_SIZE, totalCount),
      total: totalCount,
      label: "records",
    }),
    [start, totalCount]
  );

  return (
    <div className="space-y-4">
      <header className="mb-6">
        <div className="flex items-start gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-divider)", color: "var(--app-text-primary)" }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
              Upload Student Data
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--app-text-secondary)" }}>
              Upload and validate student records from CSV or Excel files
            </p>
          </div>
        </div>
      </header>

      {/* Drop zone — only shown when no file has been parsed yet */}
      {!parsed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-colors ${
            dragOver ? "border-[var(--app-brand)]" : ""
          }`}
          style={{
            borderColor: dragOver ? "var(--app-brand)" : "var(--app-divider)",
            backgroundColor: dragOver ? "var(--app-search-bg)" : "var(--app-card-bg)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <svg className="mb-3 h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--app-text-secondary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
            Drag &amp; drop a file here, or <span style={{ color: "var(--app-brand)" }}>browse</span>
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--app-text-secondary)" }}>
            Supports CSV, XLSX, XLS
          </p>
        </div>
      )}

      {/* Parsing state */}
      {parsing && (
        <div className="flex items-center gap-2 rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}>
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm" style={{ color: "var(--app-text-secondary)" }}>Parsing file…</span>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-danger)" }}>
          <p className="text-sm" style={{ color: "var(--app-danger)" }}>{parseError}</p>
        </div>
      )}

      {/* Parsed data table */}
      {parsed && (
        <>
          {/* Validation status */}
          {validationError && (
            <div className="rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-danger)" }}>
              <p className="text-sm" style={{ color: "var(--app-danger)" }}>{validationError}</p>
            </div>
          )}
          {submitError && (
            <div className="rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-danger)" }}>
              <p className="text-sm" style={{ color: "var(--app-danger)" }}>{submitError}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-success)" }}>
              <p className="text-sm" style={{ color: "var(--app-success)" }}>{submitSuccess}</p>
            </div>
          )}
          {validatedRows && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3"
              style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
            >
              <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
                {hasRowErrors ? "Validation failed. Hover red rows to see the message." : "Validation successful. You can submit now."}
              </p>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: hasRowErrors ? "var(--app-danger-bg)" : "var(--app-success-bg)",
                  color: hasRowErrors ? "var(--app-danger)" : "var(--app-success)",
                }}
              >
                {hasRowErrors ? "Has Errors" : "All Good"}
              </span>
            </div>
          )}
          {validating && (
            <div className="flex items-center gap-2 rounded-xl border px-5 py-4" style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm" style={{ color: "var(--app-text-secondary)" }}>Validating file…</span>
            </div>
          )}

          {/* File info bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>{parsed.fileName}</p>
                <p className="text-xs" style={{ color: "var(--app-text-secondary)" }}>
                  {formatSize(parsed.fileSize)} &middot; {parsed.rows.length} record{parsed.rows.length !== 1 ? "s" : ""} &middot; {parsed.headers.length} column{parsed.headers.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-secondary)" }}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Remove
            </button>
          </div>

          {/* Data table */}
          <DataTableCard
            title="Preview Data"
            pagination={
              <TablePagination
                info={paginationInfo}
                currentPage={pageIndex}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            }
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-[var(--app-search-bg)]" style={{ borderColor: "var(--app-divider)" }}>
                  <th
                    className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--app-text-secondary)" }}
                  >
                    #
                  </th>
                  {visibleHeaders.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--app-text-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pageValidated ?? []).length > 0 ? (
                  pageValidated!.map((vr, ri) => {
                  const globalIndex = start + ri;
                  const message = String(vr.message ?? "").trim();
                  const hasError = isErrorRow(vr);
                  const isValid = !hasError;
                  const rowData = (vr.data && typeof vr.data === "object")
                    ? vr.data
                    : (vr as UploadRowData);
                  const errorColumn = hasError ? detectErrorColumn(message, visibleHeaders) : null;
                  return (
                  <tr
                    key={globalIndex}
                    className="border-b transition-colors"
                    style={{
                      borderColor: "var(--app-divider)",
                      backgroundColor: hasError ? "rgba(248, 113, 113, 0.06)" : "transparent",
                      cursor: hasError ? "help" : "default",
                    }}
                    title={hasError ? message : undefined}
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums" style={{ color: "var(--app-text-secondary)" }}>
                      {vr.rowNumber ?? globalIndex + 1}
                    </td>
                    {visibleHeaders.map((h) => {
                      const cell = String(rowData[h] ?? "");
                      const isErrorCell = hasError && errorColumn === h;
                      return (
                      <td
                        key={h}
                        className="max-w-[220px] truncate whitespace-nowrap px-5 py-3 text-sm"
                        style={{
                          color: isErrorCell ? "var(--app-danger)" : "var(--app-text-primary)",
                          backgroundColor: isErrorCell ? "var(--app-danger-bg)" : "transparent",
                        }}
                        title={isErrorCell ? message : cell}
                      >
                        {cell || "—"}
                      </td>
                      );
                    })}
                  </tr>
                )})
                ) : (
                  pageRows.map((row, ri) => (
                    <tr
                      key={start + ri}
                      className="border-b transition-colors hover:bg-[var(--app-nav-hover-bg)]"
                      style={{ borderColor: "var(--app-divider)" }}
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums" style={{ color: "var(--app-text-secondary)" }}>
                        {start + ri + 1}
                      </td>
                      {visibleHeaders.map((header) => {
                        const ci = parsed.headers.indexOf(header);
                        const cell = ci >= 0 ? row[ci] ?? "" : "";
                        return (
                        <td
                          key={header}
                          className="max-w-[220px] truncate whitespace-nowrap px-5 py-3 text-sm"
                          style={{ color: "var(--app-text-primary)" }}
                          title={cell}
                        >
                          {cell || "—"}
                        </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleHeaders.length + 1}
                      className="px-5 py-12 text-center text-sm"
                      style={{ color: "var(--app-text-secondary)" }}
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTableCard>

          {/* Submit bar */}
          <div
            className="flex items-center justify-between rounded-xl border px-5 py-4"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
              {parsed.rows.length} record{parsed.rows.length !== 1 ? "s" : ""} ready to import
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating || parsing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ borderColor: "var(--app-divider)", color: "var(--app-text-primary)", backgroundColor: "var(--app-card-bg)" }}
              >
                {validating && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {validating ? "Validating…" : validatedRows ? "Re-Validate" : "Validate"}
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !validatedRows || hasRowErrors}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--app-brand)" }}
                title={!validatedRows ? "Validate the file before submitting" : hasRowErrors ? "Fix validation errors before submitting" : undefined}
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

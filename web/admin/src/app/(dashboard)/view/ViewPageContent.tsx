"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ActionBar,
  DataTableCard,
  TablePagination,
  type PaginationInfo,
} from "@/components/dashboard";
import { IconActions, StatusBadge } from "@/components/common";
import { useFetchAcademicYears, useFetchStudents, useAddPenalty, useWaivePenalty } from "@/features/students/hooks/useFetchStudents";
import { downloadStudentsAsExcel } from "@/features/students/utils/exportStudentsToExcel";
import { Modal, SelectMenu } from "@/components/common";
import { EditStudentForm } from "@/features/students/components/EditStudentForm";
import { ReceiptDropdown } from "@/features/students/components/ReceiptDropdown";
import { StudentsShimmer } from "@/features/students/components/StudentsShimmer";
import type { StudentFeeRow } from "@/features/students/types";
import { getStudentById, updateStudentById } from "@/features/students/services/students.service";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  applyDiscountBulkApi,
  waiveDiscountBulkApi,
  type PenaltyTerm,
} from "@/features/configuration/api/penalty-rules.api";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";

const PAGE_SIZE = 10;
const BRANCH = "hyd";
const ACTION_MENU_PLACEHOLDER = "__actions__";
type ActionMenuValue =
  | "upload"
  | "addPenalty"
  | "exportExcel"
  | "waivePenalty"
  | "addDiscount"
  | "waiveDiscount";
type DynamicColumn = {
  key: string;
  label: string;
  kind: "amount" | "amountAfterDiscount" | "status";
  termName: string;
};
const FALLBACK_FIELD_OPTIONS: DynamicColumn[] = [
  { key: "1st Term Fee", label: "1st Term Fee", kind: "amount", termName: "1st Term Fee" },
  {
    key: "1st Term Amount After Discount",
    label: "1st Term Amount After Discount",
    kind: "amountAfterDiscount",
    termName: "1st Term Fee",
  },
  { key: "1st Term Status", label: "1st Term Status", kind: "status", termName: "1st Term Fee" },
  { key: "2nd Term Fee", label: "2nd Term Fee", kind: "amount", termName: "2nd Term Fee" },
  {
    key: "2nd Term Amount After Discount",
    label: "2nd Term Amount After Discount",
    kind: "amountAfterDiscount",
    termName: "2nd Term Fee",
  },
  { key: "2nd Term Status", label: "2nd Term Status", kind: "status", termName: "2nd Term Fee" },
  { key: "3rd Term Fee", label: "3rd Term Fee", kind: "amount", termName: "3rd Term Fee" },
  {
    key: "3rd Term Amount After Discount",
    label: "3rd Term Amount After Discount",
    kind: "amountAfterDiscount",
    termName: "3rd Term Fee",
  },
  { key: "3rd Term Status", label: "3rd Term Status", kind: "status", termName: "3rd Term Fee" },
  { key: "4th Term Fee", label: "4th Term Fee", kind: "amount", termName: "4th Term Fee" },
  {
    key: "4th Term Amount After Discount",
    label: "4th Term Amount After Discount",
    kind: "amountAfterDiscount",
    termName: "4th Term Fee",
  },
  { key: "4th Term Status", label: "4th Term Status", kind: "status", termName: "4th Term Fee" },
];
const DEFAULT_VISIBLE_FIELD_KEYS = new Set([
  "1st Term Fee",
  "1st Term Amount After Discount",
  "1st Term Status",
  "2nd Term Fee",
  "2nd Term Amount After Discount",
  "2nd Term Status",
  "3rd Term Fee",
  "3rd Term Amount After Discount",
  "3rd Term Status",
  "4th Term Fee",
  "4th Term Amount After Discount",
  "4th Term Status",
]);
const FALLBACK_CLASS_FILTER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const FALLBACK_SECTION_FILTER = ["A", "B", "C", "D"];
const FALLBACK_PAYMENT_STATUS_FILTER = ["Paid", "Unpaid"];
const FALLBACK_TERM_FILTER = ["1st Term", "2nd Term", "3rd Term", "4th Term"];
const EXPORT_MONTH_OPTIONS = [
  "All",
  "Custom",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getAcademicYearDateBounds(yearText: string): { minDate: string; maxDate: string } | null {
  const match = yearText.match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) return null;
  return {
    minDate: `${startYear}-01-01`,
    maxDate: `${endYear}-12-31`,
  };
}

type FilterState = {
  classValue: string;
  sectionValue: string;
  paymentStatus: string;
  termValue: string;
};

type PaymentModalState = {
  open: boolean;
  studentName: string;
  termName: string;
  amount: number;
  paidTillNow: number;
  amountAfterDiscount: number;
  amountToBePaid: number;
  paymentType: string;
  feePaid: string;
  paymentDate: string;
  receiptDate: string;
  paymentTowards: string;
  remarks: string;
  bankName: string;
  bankBranch: string;
  ddNumber: string;
  ddFileName: string;
};

const DEFAULT_FILTERS: FilterState = {
  classValue: "",
  sectionValue: "",
  paymentStatus: "",
  termValue: "",
};

const DEFAULT_PAYMENT_MODAL_STATE: PaymentModalState = {
  open: false,
  studentName: "",
  termName: "",
  amount: 0,
  paidTillNow: 0,
  amountAfterDiscount: 0,
  amountToBePaid: 0,
  paymentType: "Cash",
  feePaid: "",
  paymentDate: "",
  receiptDate: "",
  paymentTowards: "Tuition Fee",
  remarks: "",
  bankName: "",
  bankBranch: "",
  ddNumber: "",
  ddFileName: "",
};

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatAmountAfterDiscount(totalDiscount?: number): string {
  if (totalDiscount == null) return "NA";
  return formatCurrency(totalDiscount);
}

const FIXED_HEADERS = [
  "", // checkbox column
  "Name",
  "Email",
  "Phone Number",
  "Admission Number",
  "Class",
  "Section",
  "Roll Number",
] as const;

const TAIL_HEADERS = ["Action"] as const;

/* ─── Sorting helpers ─── */
type SortDir = "asc" | "desc" | null;
type SortType = "string" | "number" | "status";

type SortConfig = {
  getValue: (r: StudentFeeRow) => string | number;
  type: SortType;
};

/** Build sort config for every sortable header */
function buildSortConfigs(termHeaders: string[]): Record<string, SortConfig> {
  const map: Record<string, SortConfig> = {
    "Name":             { getValue: (r) => r.name, type: "string" },
    "Email":            { getValue: (r) => r.email, type: "string" },
    "Phone Number":     { getValue: (r) => r.phone, type: "string" },
    "Admission Number": { getValue: (r) => r.admissionNumber, type: "string" },
    "Class":            { getValue: (r) => r.class, type: "string" },
    "Section":          { getValue: (r) => r.section, type: "string" },
    "Roll Number":      { getValue: (r) => r.rollNo, type: "number" },
  };
  termHeaders.forEach((t) => {
    map[t] = { getValue: (r) => r.termFees?.[t]?.amount ?? 0, type: "number" };
    map[termAmountAfterDiscountHeader(t)] = { getValue: (r) => r.termFees?.[t]?.paidAmount ?? 0, type: "number" };
    const statusKey = t.replace(/\s*Fee\s*$/i, " Status");
    map[statusKey] = { getValue: (r) => r.termFees?.[t]?.paymentStatus ?? "", type: "status" };
  });
  return map;
}

function compareFn(a: string | number, b: string | number, type: SortType, dir: "asc" | "desc"): number {
  const mul = dir === "asc" ? 1 : -1;
  if (type === "number") {
    const nA = typeof a === "number" ? a : parseFloat(String(a)) || 0;
    const nB = typeof b === "number" ? b : parseFloat(String(b)) || 0;
    return (nA - nB) * mul;
  }
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" }) * mul;
}

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex flex-col leading-none" style={{ fontSize: 8, lineHeight: "8px" }}>
      <span style={{ color: dir === "asc" ? "var(--app-text-primary)" : "var(--app-text-secondary)", opacity: dir === "asc" ? 1 : 0.35 }}>▲</span>
      <span style={{ color: dir === "desc" ? "var(--app-text-primary)" : "var(--app-text-secondary)", opacity: dir === "desc" ? 1 : 0.35 }}>▼</span>
    </span>
  );
}

/** Extract unique term names from all rows and sort (1st, 2nd, 3rd...) */
function getTermHeaders(rows: { termFees?: Record<string, { amount: number; paymentStatus: string }> }[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => {
    if (r.termFees) Object.keys(r.termFees).forEach((k) => set.add(k));
  });
  return Array.from(set).sort((a, b) => {
    const nA = parseInt(a, 10) || 0;
    const nB = parseInt(b, 10) || 0;
    if (nA !== nB) return nA - nB;
    return a.localeCompare(b);
  });
}

/** e.g. "1st Term Fee" -> "1st Term Status" */
function termStatusHeader(termName: string): string {
  return termName.replace(/\s*Fee\s*$/i, " Status");
}

function termAmountAfterDiscountHeader(termName: string): string {
  return termName.replace(/\s*Fee\s*$/i, " Amount After Discount");
}

/** Re-export for consumers that import from this file */

function EditIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

type StudentSelectOption = { admissionNumber: string; label: string };

function StudentMultiSelect({
  selected,
  onChange,
  options,
  maxSelection = 500,
  onSelectionError,
}: {
  selected: string[];
  onChange: (admissions: string[]) => void;
  options: StudentSelectOption[];
  maxSelection?: number;
  onSelectionError?: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedWithoutAll = selected.filter((value) => value !== "All");
  const allChecked = selected.includes("All") || selectedWithoutAll.length >= options.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayLabel =
    allChecked || selectedWithoutAll.length === 0
      ? "All Students"
      : selectedWithoutAll.length === 1
        ? options.find((option) => option.admissionNumber === selectedWithoutAll[0])?.label ?? "1 selected"
        : `${selectedWithoutAll.length} students selected`;

  const toggleAll = () => {
    if (!allChecked && options.length > maxSelection) {
      onSelectionError?.(`You can select a maximum of ${maxSelection} students.`);
      return;
    }
    onSelectionError?.(null);
    onChange(allChecked ? [] : ["All"]);
  };

  const toggleStudent = (admissionNumber: string) => {
    const exists = selectedWithoutAll.includes(admissionNumber);
    const next = exists
      ? selectedWithoutAll.filter((value) => value !== admissionNumber)
      : [...selectedWithoutAll, admissionNumber];
    if (!exists && next.length > maxSelection) {
      onSelectionError?.(`You can select a maximum of ${maxSelection} students.`);
      return;
    }
    onSelectionError?.(null);
    onChange(next.length === 0 || next.length >= options.length ? ["All"] : next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20 cursor-pointer"
        style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
      >
        <span className="truncate">{displayLabel}</span>
        <svg className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border py-1 shadow-lg"
          style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-search-border)" }}
        >
          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--app-nav-hover-bg)]">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-[var(--app-brand)]"
            />
            <span className="font-medium" style={{ color: "var(--app-text-primary)" }}>All Students</span>
          </label>
          <div className="mx-3 border-t" style={{ borderColor: "var(--app-search-border)" }} />
          <div className="max-h-48 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.admissionNumber}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--app-nav-hover-bg)]"
              >
                <input
                  type="checkbox"
                  checked={allChecked || selectedWithoutAll.includes(option.admissionNumber)}
                  onChange={() => toggleStudent(option.admissionNumber)}
                  className="h-4 w-4 rounded accent-[var(--app-brand)]"
                />
                <span style={{ color: "var(--app-text-primary)" }}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type ViewPageContentProps = {
  onNavigateUpload?: () => void;
};

export function ViewPageContent({ onNavigateUpload }: ViewPageContentProps) {
  const router = useRouter();
  const classMeta = useMetadata("class", {
    fallback: FALLBACK_CLASS_FILTER.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const sectionMeta = useMetadata("section", {
    fallback: FALLBACK_SECTION_FILTER.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const paymentStatusMeta = useMetadata("payment_status", {
    fallback: FALLBACK_PAYMENT_STATUS_FILTER.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  const termFilterMeta = useMetadata("term", {
    fallback: FALLBACK_TERM_FILTER.map((v, i) => ({
      value: v, label: v, displayOrder: i, isActive: true,
    })),
  });
  // Memo'd plain string arrays so existing call sites can stay simple.
  const CLASS_FILTER_OPTIONS = useMemo(
    () => classMeta.options.map((o) => o.value),
    [classMeta.options],
  );
  const SECTION_FILTER_OPTIONS = useMemo(
    () => sectionMeta.options.map((o) => o.value),
    [sectionMeta.options],
  );
  const PAYMENT_STATUS_FILTER_OPTIONS = useMemo(
    () => paymentStatusMeta.options.map((o) => o.label),
    [paymentStatusMeta.options],
  );
  const TERM_FILTER_OPTIONS = useMemo(
    () => termFilterMeta.options.map((o) => o.label),
    [termFilterMeta.options],
  );

  const [search, setSearch] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [actionMenuValue, setActionMenuValue] = useState(ACTION_MENU_PLACEHOLDER);
  const [currentPage, setCurrentPage] = useState(1);
  const [editStudent, setEditStudent] = useState<StudentFeeRow | null>(null);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [waivePenaltyOpen, setWaivePenaltyOpen] = useState(false);
  const [selectFieldsOpen, setSelectFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [waivePenaltyTerm, setWaivePenaltyTerm] = useState("");
  const [waiveSelectedStudentAdmission, setWaiveSelectedStudentAdmission] = useState<string[]>(["All"]);
  const [waiveSelectedStudentError, setWaiveSelectedStudentError] = useState<string | null>(null);
  const [penaltyTerm, setPenaltyTerm] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [selectedStudentAdmission, setSelectedStudentAdmission] = useState<string[]>(["All"]);
  const [selectedStudentError, setSelectedStudentError] = useState<string | null>(null);
  // ── Bulk discount (mirror of penalty; hits /fees/discount/add + waive) ──
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountTerm, setDiscountTerm] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountSelectedStudentAdmission, setDiscountSelectedStudentAdmission] = useState<string[]>(["All"]);
  const [discountSelectedStudentError, setDiscountSelectedStudentError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [waiveDiscountOpen, setWaiveDiscountOpen] = useState(false);
  const [waiveDiscountTerm, setWaiveDiscountTerm] = useState("");
  const [waiveDiscountReason, setWaiveDiscountReason] = useState("");
  const [waiveDiscountSelectedStudentAdmission, setWaiveDiscountSelectedStudentAdmission] = useState<string[]>(["All"]);
  const [waiveDiscountSelectedStudentError, setWaiveDiscountSelectedStudentError] = useState<string | null>(null);
  const [waiveDiscountLoading, setWaiveDiscountLoading] = useState(false);
  const [waiveDiscountError, setWaiveDiscountError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>(DEFAULT_PAYMENT_MODAL_STATE);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Set<string>>(new Set());
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<(typeof EXPORT_MONTH_OPTIONS)[number]>("All");
  const [exportFromDate, setExportFromDate] = useState(() => toDateInputValue(new Date(new Date().getFullYear(), 3, 1)));
  const [exportToDate, setExportToDate] = useState(() => toDateInputValue(new Date()));
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Custom date range is bounded by the academic year selected on the main page.
  const exportAcademicYearBounds = useMemo(
    () => getAcademicYearDateBounds(academicYear),
    [academicYear]
  );
  const {
    academicYears,
    loading: academicYearsLoading,
    error: academicYearsError,
  } = useFetchAcademicYears();
  const academicYearOptions = useMemo(
    () => academicYears.map((year) => year.academicYear),
    [academicYears]
  );

  useEffect(() => {
    if (academicYearOptions.length === 0) return;
    if (academicYear && academicYearOptions.includes(academicYear)) return;
    const currentYear =
      academicYears.find((year) => year.isCurrentYear)?.academicYear ??
      academicYearOptions[0];
    setAcademicYear(currentYear);
  }, [academicYears, academicYear, academicYearOptions]);

  const { data: rows, loading, error, refetch: refetchStudents } = useFetchStudents(BRANCH, academicYear);
  const [rowsToDisplay, setRowsToDisplay] = useState<StudentFeeRow[]>([]);

  useEffect(() => {
    setRowsToDisplay(rows);
  }, [rows]);

  const termHeaders = useMemo(() => getTermHeaders(rowsToDisplay), [rowsToDisplay]);
  const dynamicColumns = useMemo<DynamicColumn[]>(
    () =>
      termHeaders.flatMap((termName) => [
        { key: termName, label: termName, kind: "amount", termName },
        {
          key: termAmountAfterDiscountHeader(termName),
          label: termAmountAfterDiscountHeader(termName),
          kind: "amountAfterDiscount",
          termName,
        },
        { key: termStatusHeader(termName), label: termStatusHeader(termName), kind: "status", termName },
      ]),
    [termHeaders]
  );
  const selectFieldOptions = useMemo<DynamicColumn[]>(
    () => (dynamicColumns.length > 0 ? dynamicColumns : FALLBACK_FIELD_OPTIONS),
    [dynamicColumns]
  );
  const sortConfigs = useMemo(() => buildSortConfigs(termHeaders), [termHeaders]);

  useEffect(() => {
    setSelectedFieldKeys((prev) => {
      const previousKeys = Array.from(prev);
      const available = new Set(selectFieldOptions.map((c) => c.key));
      if (previousKeys.length === 0) {
        return new Set(selectFieldOptions.map((c) => c.key));
      }
      const next = previousKeys.filter((k) => available.has(k));
      return new Set(next);
    });
  }, [selectFieldOptions]);

  const toggleSort = (header: string) => {
    if (!sortConfigs[header]) return;
    if (sortKey === header) {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(header);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = rowsToDisplay;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.admissionNumber.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.email.toLowerCase().includes(q)
      );
    }
    if (activeFilters.classValue) {
      result = result.filter((r) => String(r.class) === activeFilters.classValue);
    }
    if (activeFilters.sectionValue) {
      result = result.filter((r) => String(r.section).toUpperCase() === activeFilters.sectionValue);
    }
    if (activeFilters.termValue) {
      const termKey = `${activeFilters.termValue} Fee`;
      result = result.filter((r) => !!r.termFees?.[termKey]);
      if (activeFilters.paymentStatus) {
        result = result.filter((r) => r.termFees?.[termKey]?.paymentStatus === activeFilters.paymentStatus);
      }
    } else if (activeFilters.paymentStatus) {
      result = result.filter((r) =>
        Object.values(r.termFees ?? {}).some((t) => t.paymentStatus === activeFilters.paymentStatus)
      );
    }
    if (sortKey && sortDir && sortConfigs[sortKey]) {
      const cfg = sortConfigs[sortKey];
      result = [...result].sort((a, b) => compareFn(cfg.getValue(a), cfg.getValue(b), cfg.type, sortDir));
    }
    return result;
  }, [rowsToDisplay, search, activeFilters, sortKey, sortDir, sortConfigs]);

  const selectableStudentOptions = useMemo(
    () =>
      rowsToDisplay
        .filter((student) => student.admissionNumber)
        .map((student) => ({
          admissionNumber: student.admissionNumber,
          label: `${student.name} (${student.admissionNumber})`,
        })),
    [rowsToDisplay]
  );

  const selectedAdmissionsPayload = useMemo(() => {
    const selectedWithoutAll = selectedStudentAdmission.filter((admission) => admission !== "All");
    const allSelected =
      selectedStudentAdmission.includes("All") || selectedWithoutAll.length >= selectableStudentOptions.length;
    return {
      applyToAll: allSelected,
      admissionNumbers: allSelected ? [] : selectedWithoutAll,
    };
  }, [selectedStudentAdmission, selectableStudentOptions.length]);

  const waiveSelectedAdmissionsPayload = useMemo(() => {
    const selectedWithoutAll = waiveSelectedStudentAdmission.filter((admission) => admission !== "All");
    const allSelected =
      waiveSelectedStudentAdmission.includes("All") || selectedWithoutAll.length >= selectableStudentOptions.length;
    return {
      applyToAll: allSelected,
      admissionNumbers: allSelected ? [] : selectedWithoutAll,
    };
  }, [waiveSelectedStudentAdmission, selectableStudentOptions.length]);

  const discountSelectedAdmissionsPayload = useMemo(() => {
    const selectedWithoutAll = discountSelectedStudentAdmission.filter((a) => a !== "All");
    const allSelected =
      discountSelectedStudentAdmission.includes("All") || selectedWithoutAll.length >= selectableStudentOptions.length;
    return { applyToAll: allSelected, admissionNumbers: allSelected ? [] : selectedWithoutAll };
  }, [discountSelectedStudentAdmission, selectableStudentOptions.length]);

  const waiveDiscountSelectedAdmissionsPayload = useMemo(() => {
    const selectedWithoutAll = waiveDiscountSelectedStudentAdmission.filter((a) => a !== "All");
    const allSelected =
      waiveDiscountSelectedStudentAdmission.includes("All") || selectedWithoutAll.length >= selectableStudentOptions.length;
    return { applyToAll: allSelected, admissionNumbers: allSelected ? [] : selectedWithoutAll };
  }, [waiveDiscountSelectedStudentAdmission, selectableStudentOptions.length]);

  const { addPenalty, loading: penaltyLoading } = useAddPenalty(
    academicYear,
    penaltyTerm,
    parseFloat(penaltyAmount),
    selectedAdmissionsPayload
  );
  const {
    waivePenalty,
    loading: waivePenaltyLoading,
    error: waivePenaltyError,
  } = useWaivePenalty(academicYear, waivePenaltyTerm, waiveSelectedAdmissionsPayload);

  const filteredForTable = filtered;

  const hasActiveFilters = useMemo(
    () => Object.values(activeFilters).some((value) => value !== ""),
    [activeFilters]
  );

  const canSaveFilterSelections = useMemo(
    () => Object.values(draftFilters).some((value) => value.trim() !== ""),
    [draftFilters]
  );

  const resetFilters = () => {
    setActiveFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredForTable.length / PAGE_SIZE));
  const pageIndex = Math.min(currentPage, totalPages);
  const start = (pageIndex - 1) * PAGE_SIZE;
  const pageRows = filteredForTable.slice(start, start + PAGE_SIZE);

  const paginationInfo: PaginationInfo = {
    from: filteredForTable.length === 0 ? 0 : start + 1,
    to: Math.min(start + PAGE_SIZE, filteredForTable.length),
    total: filteredForTable.length,
    label: "students",
  };

  const handleAddPenalty = async () => {
    if (!penaltyTerm || !penaltyAmount.trim()) return;
    const success = await addPenalty();
    if (!success) return;
    setPenaltyOpen(false);
    await refetchStudents();
  };

  const isAddPenaltyDisabled = !penaltyTerm || !penaltyAmount.trim();

  const handleWaivePenalty = async () => {
    if (!waivePenaltyTerm) return;
    const success = await waivePenalty();
    if (!success) return;
    setWaivePenaltyOpen(false);
    await refetchStudents();
  };

  const isAddDiscountDisabled = !discountTerm || !discountAmount.trim();

  const handleAddDiscount = async () => {
    if (!academicYear) {
      setDiscountError("Select an academic year first.");
      return;
    }
    if (isAddDiscountDisabled) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      await applyDiscountBulkApi({
        academicYear,
        term: discountTerm as PenaltyTerm,
        amount: parseFloat(discountAmount),
        applyToAll: discountSelectedAdmissionsPayload.applyToAll,
        admissionNumbers: discountSelectedAdmissionsPayload.admissionNumbers,
        reason: discountReason.trim() || undefined,
      });
      setDiscountOpen(false);
      await refetchStudents();
    } catch (err) {
      setDiscountError(getApiErrorMessage(err, "Failed to add discount"));
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleWaiveDiscount = async () => {
    if (!academicYear) {
      setWaiveDiscountError("Select an academic year first.");
      return;
    }
    if (!waiveDiscountTerm) return;
    setWaiveDiscountLoading(true);
    setWaiveDiscountError(null);
    try {
      await waiveDiscountBulkApi({
        academicYear,
        term: waiveDiscountTerm as PenaltyTerm,
        applyToAll: waiveDiscountSelectedAdmissionsPayload.applyToAll,
        admissionNumbers: waiveDiscountSelectedAdmissionsPayload.admissionNumbers,
        reason: waiveDiscountReason.trim() || undefined,
      });
      setWaiveDiscountOpen(false);
      await refetchStudents();
    } catch (err) {
      setWaiveDiscountError(getApiErrorMessage(err, "Failed to waive discount"));
    } finally {
      setWaiveDiscountLoading(false);
    }
  };

  const handlePaymentModalSave = () => {
    const feePaid = Number(paymentModal.feePaid);
    setEditStudent((prev) => {
      if (!prev || !paymentModal.termName) return prev;
      const term = prev.termFees[paymentModal.termName];
      if (!term) return prev;

      const nextPaidAmount = Math.max(
        Number(term.paidAmount ?? 0),
        Number(paymentModal.paidTillNow ?? 0) + (Number.isFinite(feePaid) ? feePaid : 0)
      );

      return {
        ...prev,
        termFees: {
          ...prev.termFees,
          [paymentModal.termName]: {
            ...term,
            paidAmount: nextPaidAmount,
            paymentStatus: "Paid",
            paymentType: paymentModal.paymentType,
            feePaid: Number.isFinite(feePaid) ? feePaid : 0,
            paymentDate: paymentModal.paymentDate,
            receiptDate: paymentModal.receiptDate,
            paymentTowards: paymentModal.paymentTowards,
            remarks: paymentModal.remarks,
            bankName: paymentModal.bankName,
            bankBranch: paymentModal.bankBranch,
            ddNumber: paymentModal.ddNumber,
            ddFileName: paymentModal.ddFileName,
          },
        },
      };
    });
    setPaymentModal(DEFAULT_PAYMENT_MODAL_STATE);
  };

  const handleEditClick = async (row: StudentFeeRow) => {
    const selectedId = row._id || row.id;
    setEditLoading(true);
    setEditStudent(row);
    setEditError(null);
    if (!selectedId) {
      setEditLoading(false);
      return;
    }

    // Keep the same edit UI visible and silently refresh with latest backend data.
    try {
      const latestStudent = await getStudentById(selectedId);
      setEditStudent((prev) => {
        if (!prev) return prev;
        const prevId = prev._id || prev.id;
        if (prevId !== selectedId) return prev;
        const mergedTermFees = Object.fromEntries(
          Object.entries(prev.termFees).map(([termName, prevTerm]) => {
            const latestTerm = latestStudent.termFees?.[termName];
            return [
              termName,
              latestTerm
                ? {
                    ...prevTerm,
                    ...latestTerm,
                  }
                : prevTerm,
            ];
          })
        );

        return {
          ...prev,
          ...latestStudent,
          termFees: mergedTermFees,
        };
      });
    } catch (err) {
      setEditError(getApiErrorMessage(err, "Failed to load student details"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditSubmit = async (updated: StudentFeeRow) => {
    const selectedId = updated._id || updated.id;
    if (!selectedId) {
      setEditError("Student id is missing.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const savedStudent = await updateStudentById(selectedId, updated);
      setRowsToDisplay((prev) =>
        prev.map((row) => {
          const sameStudent =
            (row._id && savedStudent._id && row._id === savedStudent._id) ||
            row.id === savedStudent.id ||
            row.admissionNumber === savedStudent.admissionNumber;
          return sameStudent ? savedStudent : row;
        })
      );
      setEditStudent(null);
      await refetchStudents();
    } catch (err) {
      setEditError(getApiErrorMessage(err, "Failed to update student"));
    } finally {
      setEditSaving(false);
    }
  };

  const isPaymentModalSaveDisabled = useMemo(() => {
    const feePaid = Number(paymentModal.feePaid);
    const isFeePaidValid =
      Number.isFinite(feePaid) &&
      feePaid > 0 &&
      feePaid <= Math.max(Number(paymentModal.amountToBePaid) || 0, 0);

    const hasCommonRequiredFields =
      Boolean(paymentModal.paymentType) &&
      isFeePaidValid &&
      Boolean(paymentModal.paymentDate) &&
      Boolean(paymentModal.receiptDate) &&
      Boolean(paymentModal.paymentTowards.trim());

    if (!hasCommonRequiredFields) return true;

    const needsDdFields = paymentModal.paymentType === "DD" || paymentModal.paymentType === "Check";
    if (!needsDdFields) return false;

    return !(
      paymentModal.bankName.trim() &&
      paymentModal.bankBranch.trim() &&
      paymentModal.ddNumber.trim() &&
      paymentModal.ddFileName.trim()
    );
  }, [paymentModal]);

  const handleExportExcel = () => {
    const bounds = getAcademicYearDateBounds(academicYear);
    setExportMonth("All");
    setExportFromDate(bounds?.minDate ?? toDateInputValue(new Date(new Date().getFullYear(), 3, 1)));
    setExportToDate(bounds?.maxDate ?? toDateInputValue(new Date()));
    setExportError(null);
    setExportModalOpen(true);
  };

  const getRowsByMonth = (sourceRows: StudentFeeRow[], monthLabel: string): StudentFeeRow[] => {
    if (monthLabel === "All" || monthLabel === "Custom") return sourceRows;
    // EXPORT_MONTH_OPTIONS starts with "All" and "Custom", so "January" sits at
    // index 2 → JS month 0. Subtract 2 to line up with Date.getMonth().
    const monthIndex = EXPORT_MONTH_OPTIONS.indexOf(monthLabel as (typeof EXPORT_MONTH_OPTIONS)[number]) - 2;
    if (monthIndex < 0) return sourceRows;

    const getPaymentDates = (paymentDate?: string, paymentDates?: string[]) =>
      paymentDates && paymentDates.length > 0 ? paymentDates : paymentDate ? [paymentDate] : [];

    return sourceRows.filter((row) =>
      Object.values(row.termFees ?? {}).some((term) => {
        const termPaymentDates = getPaymentDates(term.paymentDate, term.paymentDates);
        return termPaymentDates.some((dateText) => {
          const parsedDate = new Date(dateText);
          if (Number.isNaN(parsedDate.getTime())) return false;
          return parsedDate.getMonth() === monthIndex;
        });
      })
    );
  };

  const getRowsByDateRange = (sourceRows: StudentFeeRow[], fromDate: string, toDate: string): StudentFeeRow[] => {
    if (!fromDate || !toDate) return sourceRows;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return sourceRows;
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const getPaymentDates = (paymentDate?: string, paymentDates?: string[]) =>
      paymentDates && paymentDates.length > 0 ? paymentDates : paymentDate ? [paymentDate] : [];

    return sourceRows.filter((row) =>
      Object.values(row.termFees ?? {}).some((term) => {
        const termPaymentDates = getPaymentDates(term.paymentDate, term.paymentDates);
        return termPaymentDates.some((dateText) => {
          const paidAt = new Date(dateText);
          if (Number.isNaN(paidAt.getTime())) return false;
          return paidAt >= from && paidAt <= to;
        });
      })
    );
  };

  const handleExportExcelSubmit = () => {
    setExportLoading(true);
    setExportError(null);

    try {
      const isCustomDateEnabled = exportMonth === "Custom";
      const effectiveFromDate = isCustomDateEnabled ? exportFromDate : "";
      const effectiveToDate = isCustomDateEnabled ? exportToDate : "";

      if (effectiveFromDate && effectiveToDate && effectiveFromDate > effectiveToDate) {
        setExportError("From date should be less than or equal to To date.");
        return;
      }
      if (
        isCustomDateEnabled &&
        exportAcademicYearBounds &&
        (
          effectiveFromDate < exportAcademicYearBounds.minDate ||
          effectiveFromDate > exportAcademicYearBounds.maxDate ||
          effectiveToDate < exportAcademicYearBounds.minDate ||
          effectiveToDate > exportAcademicYearBounds.maxDate
        )
      ) {
        setExportError(
          `Custom date must be within selected academic year (${exportAcademicYearBounds.minDate} to ${exportAcademicYearBounds.maxDate}).`
        );
        return;
      }

      // Export exactly what the table is currently showing: the filtered + sorted rows,
      // then narrowed by the selected report month / custom date range.
      const exportRows = getRowsByDateRange(
        getRowsByMonth(filteredForTable, exportMonth),
        effectiveFromDate,
        effectiveToDate
      );

      if (exportRows.length === 0) {
        setExportError("No records found for the current view.");
        return;
      }

      const yearLabel = (academicYear || "all").replace(/\s+/g, "");
      const monthLabel = exportMonth.toLowerCase();
      const rangeLabel = effectiveFromDate && effectiveToDate ? `${effectiveFromDate}_to_${effectiveToDate}` : "all-dates";
      const name = `students-fee-${yearLabel}-${monthLabel}-${rangeLabel}.xlsx`;
      downloadStudentsAsExcel(
        exportRows,
        name,
        visibleDynamicColumns.map((c) => ({ label: c.label, kind: c.kind, termName: c.termName }))
      );
      setExportModalOpen(false);
    } catch (err) {
      setExportError(getApiErrorMessage(err, "Failed to export students"));
    } finally {
      setExportLoading(false);
    }
  };

  const openAddPenaltyModal = () => {
    setPenaltyTerm("");
    setPenaltyAmount("");
    setSelectedStudentAdmission(["All"]);
    setSelectedStudentError(null);
    setPenaltyOpen(true);
  };

  const openAddDiscountModal = () => {
    setDiscountTerm("");
    setDiscountAmount("");
    setDiscountReason("");
    setDiscountSelectedStudentAdmission(["All"]);
    setDiscountSelectedStudentError(null);
    setDiscountError(null);
    setDiscountOpen(true);
  };

  const openWaiveDiscountModal = () => {
    setWaiveDiscountTerm("");
    setWaiveDiscountReason("");
    setWaiveDiscountSelectedStudentAdmission(["All"]);
    setWaiveDiscountSelectedStudentError(null);
    setWaiveDiscountError(null);
    setWaiveDiscountOpen(true);
  };

  const openWaivePenaltyModal = () => {
    setWaivePenaltyTerm("");
    setWaiveSelectedStudentAdmission(["All"]);
    setWaiveSelectedStudentError(null);
    setWaivePenaltyOpen(true);
  };

  const handleActionMenuSelect = (value: string) => {
    setActionMenuValue(value);
    const action = value as ActionMenuValue;
    if (action === "upload") {
      onNavigateUpload?.();
    } else if (action === "addPenalty") {
      openAddPenaltyModal();
    } else if (action === "exportExcel") {
      handleExportExcel();
    } else if (action === "waivePenalty") {
      openWaivePenaltyModal();
    } else if (action === "addDiscount") {
      openAddDiscountModal();
    } else if (action === "waiveDiscount") {
      openWaiveDiscountModal();
    }
    setActionMenuValue(ACTION_MENU_PLACEHOLDER);
  };

  const visibleDynamicColumns = useMemo(
    () => {
      const source = dynamicColumns.length > 0 ? dynamicColumns : FALLBACK_FIELD_OPTIONS;
      if (selectedFieldKeys.size === 0) {
        return source.filter((c) => DEFAULT_VISIBLE_FIELD_KEYS.has(c.key));
      }
      return source.filter((c) => selectedFieldKeys.has(c.key));
    },
    [dynamicColumns, selectedFieldKeys]
  );

  /** For each term: "1st Term Fee" (amount) then "1st Term Status" (status) */
  const tableHeaders = useMemo(
    () => [
      ...FIXED_HEADERS.slice(1),
      ...visibleDynamicColumns.map((c) => c.label),
      ...TAIL_HEADERS,
    ],
    [visibleDynamicColumns]
  );
  const totalColSpan = tableHeaders.length;

  if (loading) return <StudentsShimmer />;

  return (
    <div className="space-y-2">
      <ActionBar
        actionOptions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SelectMenu
              aria-label="Actions"
              value={actionMenuValue}
              emptyValue={ACTION_MENU_PLACEHOLDER}
              placeholder="Actions"
              onChange={handleActionMenuSelect}
              className="w-full sm:w-auto sm:min-w-[11rem]"
              options={[
                { value: "upload", label: "Upload" },
                { value: "addPenalty", label: "Add Penalty" },
                { value: "waivePenalty", label: "Waive Off Penalty" },
                { value: "addDiscount", label: "Apply Discount" },
                { value: "waiveDiscount", label: "Waive Off Discount" },
                { value: "exportExcel", label: "Export Excel" },
              ]}
            />
            <SelectMenu
              aria-label="Academic year"
              value={academicYear}
              emptyValue=""
              onChange={setAcademicYear}
              disabled={academicYearsLoading || academicYearOptions.length === 0}
              placeholder={
                academicYearsLoading
                  ? "Loading academic years…"
                  : academicYearsError
                    ? "Failed to load academic years"
                    : academicYearOptions.length === 0
                      ? "No academic years"
                      : "Select year"
              }
              className="w-full sm:w-auto sm:min-w-[12rem]"
              options={academicYearOptions.map((year) => ({ value: year, label: year }))}
            />
          </div>
        }
       
        filterOptions={
          <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
            <button
              type="button"
              className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium sm:gap-2 sm:text-base cursor-pointer"
              style={{ color: "var(--app-brand)" }}
              onClick={() => setSelectFieldsOpen(true)}
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              <span className="truncate">Select labels</span>
            </button>
            <button
              type="button"
              className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium sm:gap-2 sm:text-base cursor-pointer"
              style={{ color: "var(--app-brand)" }}
              onClick={() => {
                setDraftFilters(activeFilters);
                setFiltersOpen(true);
              }}
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M7 12h10M10 18h4" />
              </svg>
              <span className="truncate">Add Filters</span>
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium sm:gap-2 sm:text-base cursor-pointer"
                style={{ color: "var(--app-danger)" }}
                onClick={resetFilters}
              >
                <span className="truncate">Reset Filters</span>
              </button>
            )}
          </div>
        }
        searchPlaceholder="Search students..."
        searchValue={search}
        onSearchChange={setSearch}
      />
      <DataTableCard
        title="Student Fee List"
        pagination={
          <TablePagination
            info={paginationInfo}
            currentPage={pageIndex}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        }
      >
        <div className="space-y-4 p-4 sm:hidden">
          {error && rows.length > 0 && (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: "var(--app-divider)", color: "var(--app-danger)" }}
            >
              {error}
            </div>
          )}
          {pageRows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border p-4 shadow-sm"
              style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-card-bg)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold flex items-center gap-2" style={{ color: "var(--app-text-primary)" }}>
                    {row.name || "—"}
                    {row.tcIssuedAt && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                        TC
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--app-text-secondary)" }}>
                    {row.admissionNumber || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border px-1.5 py-1" style={{ borderColor: "var(--app-divider)" }}>
                  <ReceiptDropdown student={row} academicYear={academicYear} />
                  <IconActions
                    actions={[
                      { label: "Edit", onClick: () => { void handleEditClick(row); }, icon: <EditIcon /> },
                      {
                        label: "Profile / Issue TC",
                        onClick: () => {
                          if (row.admissionNumber) {
                            router.push(
                              `/students/by-admission/${encodeURIComponent(row.admissionNumber)}`,
                            );
                          }
                        },
                        icon: <ProfileIcon />,
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Email</p>
                  <p className="mt-0.5 break-all text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Admission Number</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.admissionNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Class</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.class || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Section</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.section || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Phone</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>Roll Number</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--app-text-primary)" }}>{row.rollNo || "—"}</p>
                </div>
              </div>

              {visibleDynamicColumns.length > 0 && (
                <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--app-divider)" }}>
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
                    Term Details
                  </p>
                  <div className="space-y-3">
                    {Array.from(new Set(visibleDynamicColumns.map((col) => col.termName))).map((termName) => {
                      const term = row.termFees?.[termName];
                      const termFields = visibleDynamicColumns.filter((col) => col.termName === termName);
                      if (termFields.length === 0) return null;

                      return (
                        <div
                          key={`${row.id}-${termName}`}
                          className="rounded-lg border p-2.5"
                          style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-search-bg)" }}
                        >
                          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--app-text-primary)" }}>
                            {termName}
                          </p>
                          <div className="space-y-1.5">
                            {termFields.map((col) => (
                              <div key={`${row.id}-${col.key}`} className="flex items-center justify-between gap-3 text-xs">
                                <span className="min-w-0 flex-1" style={{ color: "var(--app-text-secondary)" }}>
                                  {col.kind === "amount"
                                    ? "Amount"
                                    : col.kind === "amountAfterDiscount"
                                      ? "Amount After Discount"
                                      : "Status"}
                                </span>
                                <span className="shrink-0 text-right" style={{ color: "var(--app-text-primary)" }}>
                                  {col.kind === "amount" ? (
                                    term?.amount != null ? `₹${Number(term.amount).toLocaleString("en-IN")}` : "—"
                                  ) : col.kind === "amountAfterDiscount" ? (
                                    formatAmountAfterDiscount(term?.totalDiscount)
                                  ) : term ? (
                                    <StatusBadge variant={term.paymentStatus === "Paid" ? "success" : "warning"}>
                                      {term.paymentStatus || "—"}
                                    </StatusBadge>
                                  ) : (
                                    "—"
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          {pageRows.length === 0 && (
            <div
              className="rounded-xl border px-4 py-8 text-center text-sm"
              style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
            >
              No students found.
            </div>
          )}
        </div>

        <table className="hidden w-full min-w-max text-left text-xs sm:table sm:text-sm">
          <thead>
            <tr className="border-b bg-[var(--app-search-bg)]" style={{ borderColor: "var(--app-divider)" }}>
              {tableHeaders.map((header) => {
                const sortable = !!sortConfigs[header];
                return (
                  <th
                    key={header}
                    className={`px-3 py-3 text-xs font-semibold sm:px-6 sm:py-4 sm:text-sm ${sortable ? "cursor-pointer select-none" : ""}`}
                    style={{ color: "var(--app-text-secondary)" }}
                    onClick={sortable ? () => toggleSort(header) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {header}
                      {sortKey === header && sortDir && <SortIcon dir={sortDir} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {error && rows.length > 0 && (
              <tr style={{ borderColor: "var(--app-divider)" }}>
                <td colSpan={totalColSpan} className="px-6 py-12 text-center text-sm" style={{ color: "var(--app-danger)" }}>
                  {error}
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className="border-b cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--app-table-row-hover)] last:border-b-0"
                style={{ borderColor: "var(--app-divider)" }}
              >
                <td className="px-3 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: "var(--app-text-primary)" }}>{row.name || "—"}</span>
                    {row.tcIssuedAt && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.05em] bg-slate-200 text-slate-700"
                        title={`TC issued on ${new Date(row.tcIssuedAt).toLocaleDateString("en-IN")}`}
                      >
                        TC issued
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.email || "—"}</td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.phone || "—"}</td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.admissionNumber || "—"}</td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.class || "—"}</td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.section || "—"}</td>
                <td className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-secondary)" }}>{row.rollNo || "—"}</td>
                {visibleDynamicColumns.map((col) => {
                  const term = row.termFees?.[col.termName];
                  return (
                    <td key={col.key} className="px-3 py-3 sm:px-6 sm:py-4" style={{ color: "var(--app-text-primary)" }}>
                      {col.kind === "amount" ? (
                        term?.amount != null ? `₹${Number(term.amount).toLocaleString("en-IN")}` : "—"
                      ) : col.kind === "amountAfterDiscount" ? (
                        formatAmountAfterDiscount(term?.totalDiscount)
                      ) : term ? (
                        <StatusBadge variant={term.paymentStatus === "Paid" ? "success" : "warning"}>
                          {term.paymentStatus || "—"}
                        </StatusBadge>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-1">
                    <ReceiptDropdown student={row} academicYear={academicYear} />
                    <IconActions
                      actions={[
                        { label: "Edit", onClick: () => { void handleEditClick(row); }, icon: <EditIcon /> },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr style={{ borderColor: "var(--app-divider)" }}>
                <td colSpan={totalColSpan} className="px-6 py-12 text-center text-sm" style={{ color: "var(--app-text-secondary)" }}>
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DataTableCard>

      <Modal
        open={exportModalOpen}
        onClose={() => {
          if (exportLoading) return;
          setExportModalOpen(false);
        }}
        title="Export Excel"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              disabled={exportLoading}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                handleExportExcelSubmit();
              }}
              disabled={exportLoading}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {exportLoading ? "Exporting..." : "Export"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
              Reports
            </label>
            <SelectMenu
              aria-label="Reports"
              value={exportMonth}
              onChange={(value) => setExportMonth(value as (typeof EXPORT_MONTH_OPTIONS)[number])}
              usePortal={false}
              className="w-full"
              options={EXPORT_MONTH_OPTIONS.map((month) => ({ value: month, label: month }))}
            />
          </div>

          {exportMonth === "Custom" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
                Custom Data
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium" style={{ color: "var(--app-text-secondary)" }}>
                    From
                  </label>
                  <input
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                    min={exportAcademicYearBounds?.minDate}
                    max={exportAcademicYearBounds?.maxDate}
                    className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
                    style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" style={{ color: "var(--app-text-secondary)" }}>
                    To
                  </label>
                  <input
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                    min={exportAcademicYearBounds?.minDate}
                    max={exportAcademicYearBounds?.maxDate}
                    className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
                    style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
                  />
                </div>
              </div>
            </div>
          )}

          {exportError && (
            <p className="text-sm font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
              {exportError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={editStudent !== null}
        onClose={() => setEditStudent(null)}
        title="Edit Student"
        size="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditStudent(null)}
              className="h-10 w-full rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] sm:w-auto cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-student-form"
              disabled={editLoading || editSaving || !editStudent}
              className="h-10 w-full rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 sm:w-auto cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        {editError && (
          <div
            className="mb-3 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--app-danger)", color: "var(--app-danger)" }}
          >
            {editError}
          </div>
        )}
        {editLoading && (
          <div className="py-6 text-center text-sm" style={{ color: "var(--app-text-secondary)" }}>
            Loading student details...
          </div>
        )}
        {!editLoading && editStudent && (
          <EditStudentForm
            student={editStudent}
            formId="edit-student-form"
            onStatusChangeToPaid={(payload) => {
              setPaymentModal({
                ...DEFAULT_PAYMENT_MODAL_STATE,
                open: true,
                studentName: payload.studentName,
                termName: payload.termName,
                amount: payload.amount,
                paidTillNow: payload.paidTillNow,
                amountAfterDiscount: payload.amountAfterDiscount,
                amountToBePaid: payload.amountToBePaid,
              });
            }}
            onSubmit={(updated) => { void handleEditSubmit(updated); }}
          />
        )}
      </Modal>

      {/* Add Penalty Modal */}
      <Modal
        open={penaltyOpen}
        onClose={() => setPenaltyOpen(false)}
        title="Add Penalty"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPenaltyOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-penalty-form"
              disabled={isAddPenaltyDisabled || penaltyLoading}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {penaltyLoading ? "Adding..." : "Add Penalty"}
            </button>
          </>
        }
      >
        <form
          id="add-penalty-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddPenalty();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Select Student
            </label>
            <StudentMultiSelect
              selected={selectedStudentAdmission}
              onChange={(admissions) => {
                setSelectedStudentAdmission(admissions);
                setSelectedStudentError(null);
                setCurrentPage(1);
              }}
              options={selectableStudentOptions}
              maxSelection={500}
              onSelectionError={setSelectedStudentError}
            />
            {selectedStudentError && (
              <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
                {selectedStudentError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Term
            </label>
            <select
              value={penaltyTerm}
              onChange={(e) => setPenaltyTerm(e.target.value)}
              required
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            >
              <option value="" disabled>Select term</option>
              {termHeaders.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Penalty Amount
            </label>
            <input
              type="number"
              min="1"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              required
              placeholder="Enter amount"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={waivePenaltyOpen}
        onClose={() => setWaivePenaltyOpen(false)}
        title="Select Term"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setWaivePenaltyOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleWaivePenalty();
              }}
              disabled={!waivePenaltyTerm || waivePenaltyLoading}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {waivePenaltyLoading ? "Submitting..." : "Submit"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Select Student
            </label>
            <StudentMultiSelect
              selected={waiveSelectedStudentAdmission}
              onChange={(admissions) => {
                setWaiveSelectedStudentAdmission(admissions);
                setWaiveSelectedStudentError(null);
              }}
              options={selectableStudentOptions}
              maxSelection={500}
              onSelectionError={setWaiveSelectedStudentError}
            />
            {waiveSelectedStudentError && (
              <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
                {waiveSelectedStudentError}
              </p>
            )}
          </div>
          <label className="block text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
            Select The Term
          </label>
          <select
            value={waivePenaltyTerm}
            onChange={(e) => setWaivePenaltyTerm(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
            style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
          >
            <option value="" disabled>Select The Term</option>
            {termHeaders.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {waivePenaltyError && (
            <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
              {waivePenaltyError}
            </p>
          )}
        </div>
      </Modal>

      {/* Apply Discount Modal */}
      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Apply Discount"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDiscountOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-discount-form"
              disabled={isAddDiscountDisabled || discountLoading}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {discountLoading ? "Applying..." : "Apply Discount"}
            </button>
          </>
        }
      >
        <form
          id="add-discount-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddDiscount();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Select Student
            </label>
            <StudentMultiSelect
              selected={discountSelectedStudentAdmission}
              onChange={(admissions) => {
                setDiscountSelectedStudentAdmission(admissions);
                setDiscountSelectedStudentError(null);
              }}
              options={selectableStudentOptions}
              maxSelection={500}
              onSelectionError={setDiscountSelectedStudentError}
            />
            {discountSelectedStudentError && (
              <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
                {discountSelectedStudentError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Term
            </label>
            <select
              value={discountTerm}
              onChange={(e) => setDiscountTerm(e.target.value)}
              required
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            >
              <option value="" disabled>Select term</option>
              {termHeaders.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Discount Amount
            </label>
            <input
              type="number"
              min="1"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              required
              placeholder="Enter amount"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Reason (optional)
            </label>
            <input
              type="text"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="e.g. Sibling concession"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>
          {discountError && (
            <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
              {discountError}
            </p>
          )}
        </form>
      </Modal>

      {/* Waive Discount Modal */}
      <Modal
        open={waiveDiscountOpen}
        onClose={() => setWaiveDiscountOpen(false)}
        title="Waive Off Discount"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setWaiveDiscountOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleWaiveDiscount();
              }}
              disabled={!waiveDiscountTerm || waiveDiscountLoading}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {waiveDiscountLoading ? "Submitting..." : "Submit"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Select Student
            </label>
            <StudentMultiSelect
              selected={waiveDiscountSelectedStudentAdmission}
              onChange={(admissions) => {
                setWaiveDiscountSelectedStudentAdmission(admissions);
                setWaiveDiscountSelectedStudentError(null);
              }}
              options={selectableStudentOptions}
              maxSelection={500}
              onSelectionError={setWaiveDiscountSelectedStudentError}
            />
            {waiveDiscountSelectedStudentError && (
              <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
                {waiveDiscountSelectedStudentError}
              </p>
            )}
          </div>
          <label className="block text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
            Select The Term
          </label>
          <select
            value={waiveDiscountTerm}
            onChange={(e) => setWaiveDiscountTerm(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
            style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
          >
            <option value="" disabled>Select The Term</option>
            {termHeaders.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
              Reason (optional)
            </label>
            <input
              type="text"
              value={waiveDiscountReason}
              onChange={(e) => setWaiveDiscountReason(e.target.value)}
              placeholder="e.g. Concession revoked"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>
          {waiveDiscountError && (
            <p className="text-xs font-medium" style={{ color: "var(--app-error, #dc2626)" }}>
              {waiveDiscountError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={selectFieldsOpen}
        onClose={() => setSelectFieldsOpen(false)}
        title="Select Fields"
        size="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectFieldsOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {selectFieldOptions.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-base font-medium" style={{ color: "var(--app-text-primary)" }}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={selectedFieldKeys.has(field.key)}
                onChange={() => {
                  setSelectedFieldKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(field.key)) next.delete(field.key);
                    else next.add(field.key);
                    return next;
                  });
                }}
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Select Filter"
        size="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setFiltersOpen(false);
              }}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilters(draftFilters);
                setCurrentPage(1);
                setFiltersOpen(false);
              }}
              disabled={!canSaveFilterSelections}
              title={!canSaveFilterSelections ? "Select class, section, payment status, and term to save" : undefined}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Select Classes</label>
            <SelectMenu
              aria-label="Select Classes"
              value={draftFilters.classValue}
              emptyValue=""
              placeholder="Select Class"
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, classValue: value }))}
              usePortal={false}
              className="h-10 w-full rounded-lg px-3 text-sm"
              options={CLASS_FILTER_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Select Sections</label>
            <SelectMenu
              aria-label="Select Sections"
              value={draftFilters.sectionValue}
              emptyValue=""
              placeholder="Select Section"
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, sectionValue: value }))}
              usePortal={false}
              className="h-10 w-full rounded-lg px-3 text-sm"
              options={SECTION_FILTER_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Select Payment Status</label>
            <SelectMenu
              aria-label="Select Payment Status"
              value={draftFilters.paymentStatus}
              emptyValue=""
              placeholder="Select Payment Status"
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, paymentStatus: value }))}
              usePortal={false}
              className="h-10 w-full rounded-lg px-3 text-sm"
              options={PAYMENT_STATUS_FILTER_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Select Term</label>
            <SelectMenu
              aria-label="Select Term"
              value={draftFilters.termValue}
              emptyValue=""
              placeholder="Select Term"
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, termValue: value }))}
              usePortal={false}
              className="h-10 w-full rounded-lg px-3 text-sm"
              options={TERM_FILTER_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={paymentModal.open}
        onClose={() => setPaymentModal(DEFAULT_PAYMENT_MODAL_STATE)}
        title="Payment Type"
        size="2xl"
        mobileFullscreen
        footer={
          <>
            <button
              type="button"
              onClick={() => setPaymentModal(DEFAULT_PAYMENT_MODAL_STATE)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePaymentModalSave}
              disabled={isPaymentModalSaveDisabled}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Select Type Of Payment</label>
            <SelectMenu
              aria-label="Select Type Of Payment"
              value={paymentModal.paymentType}
              onChange={(value) => setPaymentModal((prev) => ({ ...prev, paymentType: value }))}
              usePortal={false}
              className="w-full"
              options={[
                { value: "Cash", label: "Cash" },
                { value: "UPI", label: "UPI" },
                { value: "Card", label: "Card" },
                { value: "Bank Transfer", label: "Bank Transfer" },
                { value: "DD", label: "DD" },
                { value: "Check", label: "Check" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-4" style={{ color: "var(--app-text-primary)" }}>
            <div>Amount : Rs.{paymentModal.amount}/-</div>
            <div>Amount paid till now : Rs.{paymentModal.paidTillNow}</div>
            <div>Amount After Discount : Rs.{paymentModal.amountAfterDiscount}</div>
            <div>Amount To Be Paid : Rs.{paymentModal.amountToBePaid}</div>
          </div>

          <div className="space-y-1.5">
            <input
              type="number"
              min="0"
              value={paymentModal.feePaid}
              onChange={(e) => setPaymentModal((prev) => ({ ...prev, feePaid: e.target.value }))}
              placeholder="Enter Fee Paid"
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>

          {(paymentModal.paymentType === "DD" || paymentModal.paymentType === "Check") && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Bank Name</label>
                <input
                  type="text"
                  value={paymentModal.bankName}
                  onChange={(e) => setPaymentModal((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
                  style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Bank Branch</label>
                <input
                  type="text"
                  value={paymentModal.bankBranch}
                  onChange={(e) => setPaymentModal((prev) => ({ ...prev, bankBranch: e.target.value }))}
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
                  style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>DD Number</label>
                <input
                  type="text"
                  value={paymentModal.ddNumber}
                  onChange={(e) => setPaymentModal((prev) => ({ ...prev, ddNumber: e.target.value }))}
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
                  style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
                />
              </div>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="payment-dd-upload"
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--app-success, #5bb972)" }}
                >
                  Upload DD
                </label>
                <input
                  id="payment-dd-upload"
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    setPaymentModal((prev) => ({ ...prev, ddFileName: e.target.files?.[0]?.name || "" }))
                  }
                />
                {paymentModal.ddFileName && (
                  <span className="text-sm" style={{ color: "var(--app-text-secondary)" }}>{paymentModal.ddFileName}</span>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Payment Date</label>
            <input
              type="date"
              value={paymentModal.paymentDate}
              onChange={(e) => setPaymentModal((prev) => ({ ...prev, paymentDate: e.target.value }))}
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Receipt Date</label>
            <input
              type="date"
              value={paymentModal.receiptDate}
              onChange={(e) => setPaymentModal((prev) => ({ ...prev, receiptDate: e.target.value }))}
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Payment Towards</label>
            <input
              type="text"
              value={paymentModal.paymentTowards}
              onChange={(e) => setPaymentModal((prev) => ({ ...prev, paymentTowards: e.target.value }))}
              className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>Remarks</label>
            <textarea
              value={paymentModal.remarks}
              onChange={(e) => setPaymentModal((prev) => ({ ...prev, remarks: e.target.value }))}
              className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
              style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }}
            />
          </div>

        </div>
      </Modal>
    </div>
  );
}

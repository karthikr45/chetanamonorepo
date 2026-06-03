import * as XLSX from "xlsx";
import type { StudentFeeRow } from "@/features/students/types";

type ExportDynamicColumn = {
  label: string;
  kind: "amount" | "amountAfterDiscount" | "status";
  termName: string;
};

function getTermHeaders(rows: StudentFeeRow[]): string[] {
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

export function downloadStudentsAsExcel(
  rows: StudentFeeRow[],
  filename = "students-export.xlsx",
  dynamicColumns?: ExportDynamicColumn[]
): void {
  const termHeaders = getTermHeaders(rows);
  const resolvedDynamicColumns: ExportDynamicColumn[] =
    dynamicColumns && dynamicColumns.length > 0
      ? dynamicColumns
      : termHeaders.flatMap((termName) => [
          { label: termName, kind: "amount" as const, termName },
          { label: termAmountAfterDiscountHeader(termName), kind: "amountAfterDiscount" as const, termName },
          { label: termStatusHeader(termName), kind: "status" as const, termName },
        ]);

  const headers = [
    "Name",
    "Email",
    "Phone Number",
    "Admission Number",
    "Class",
    "Section",
    "Roll Number",
    ...resolvedDynamicColumns.map((c) => c.label),
  ];

  function rowToExcelRow(row: StudentFeeRow): string[] {
    const base = [
      row.name || "—",
      row.email || "—",
      row.phone || "—",
      row.admissionNumber || "—",
      row.class || "—",
      row.section || "—",
      row.rollNo || "—",
    ];
    const termCells = resolvedDynamicColumns.map((column) => {
      const t = row.termFees?.[column.termName];
      if (column.kind === "amount") {
        return t?.amount != null ? `₹${Number(t.amount).toLocaleString("en-IN")}` : "—";
      }
      if (column.kind === "amountAfterDiscount") {
        return t?.totalDiscount != null ? `₹${Number(t.totalDiscount).toLocaleString("en-IN")}` : "NA";
      }
      return t?.paymentStatus ?? "—";
    });
    return [...base, ...termCells];
  }

  const data = [headers, ...rows.map(rowToExcelRow)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, filename);
}

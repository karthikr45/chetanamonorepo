"use client";

import { useState, useEffect, useMemo } from "react";
import { SelectMenu } from "@/components/common";
import { useAuth } from "@/features/auth";
import { useMetadata } from "@/features/system-metadata/hooks/useMetadata";
import type { StudentFeeRow, TermFeeItem } from "@/features/students/types";

// Academic-year months in billing order (Apr → Mar).
const FALLBACK_MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

const MONTH_INDEX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/**
 * True when an academic-year month (e.g. "April" of "2026-2027") has fully
 * elapsed — strictly before the current calendar month. The current and
 * future months return false. Mirrors the API rule.
 */
function isPastAcademicMonth(academicYear: string | undefined, month: string): boolean {
  const idx = MONTH_INDEX[month];
  if (idx === undefined || !academicYear) return false;
  const m = academicYear.match(/^(\d{4})-(\d{4})$/);
  if (!m) return false;
  const calYear = idx >= 3 ? Number(m[1]) : Number(m[2]);
  const now = new Date();
  return (
    calYear < now.getFullYear() ||
    (calYear === now.getFullYear() && idx < now.getMonth())
  );
}

export interface EditStudentFormProps {
  student: StudentFeeRow;
  formId: string;
  onSubmit: (updated: StudentFeeRow) => void;
  onStatusChangeToPaid?: (payload: {
    studentName: string;
    termName: string;
    amount: number;
    paidTillNow: number;
    amountAfterDiscount: number;
    amountToBePaid: number;
  }) => void;
}

const inputClass =
  "h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20";

const inputStyle = {
  borderColor: "var(--app-search-border)",
  backgroundColor: "var(--app-card-bg)",
  color: "var(--app-text-primary)",
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function EditStudentForm({ student, formId, onSubmit, onStatusChangeToPaid }: EditStudentFormProps) {
  const [form, setForm] = useState<StudentFeeRow>(() => ({
    ...student,
    termFees: { ...student.termFees },
  }));

  useEffect(() => {
    setForm({ ...student, termFees: { ...student.termFees } });
  }, [student]);

  const { user } = useAuth();
  const isTransport =
    (user?.tenantType ?? "").toLowerCase() === "transport" ||
    form.pickupLocation != null ||
    form.dropLocation != null;
  // Monthly-billing tenants (transport by default) bill per academic-year
  // month, not per term — show all 12 months so admins can add a month that
  // wasn't billed yet and change boarding/drop month-wise.
  const isMonthly =
    (user?.billingMode ?? "").toLowerCase() === "monthly" ||
    ((user?.tenantType ?? "").toLowerCase() === "transport" && !user?.billingMode);

  const { options: monthOpts } = useMetadata("month", {
    fallback: FALLBACK_MONTHS.map((v, i) => ({
      value: v,
      label: v,
      displayOrder: i,
      isActive: true,
    })),
  });
  const MONTHS = useMemo(() => monthOpts.map((o) => o.value), [monthOpts]);

  const set = (field: keyof StudentFeeRow, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setTermFee = (termName: string, field: keyof TermFeeItem, value: string | number) => {
    setForm((prev) => {
      const existing = prev.termFees[termName] ?? { amount: 0, paymentStatus: "Unpaid" };
      const prevStatus = String(existing.paymentStatus || "").toLowerCase();
      const nextStatus = field === "paymentStatus" ? String(value || "").toLowerCase() : prevStatus;
      if (field === "paymentStatus" && prevStatus !== "paid" && nextStatus === "paid") {
        const amount = Number(existing.amount ?? 0);
        const paidTillNow = Number(existing.paidAmount ?? 0);
        const amountAfterDiscount = amount;
        const amountToBePaid = Math.max(amountAfterDiscount - paidTillNow, 0);
        onStatusChangeToPaid?.({
          studentName: prev.name,
          termName,
          amount,
          paidTillNow,
          amountAfterDiscount,
          amountToBePaid,
        });
      }
      return {
        ...prev,
        termFees: {
          ...prev.termFees,
          [termName]: { ...existing, [field]: value },
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  // Monthly tenants show every academic-year month (Apr→Mar) so a not-yet
  // billed month can be added inline; term-wise tenants show the terms that
  // already exist, in ordinal order.
  const periodNames = isMonthly
    ? MONTHS
    : Object.keys(form.termFees).sort((a, b) => {
        const nA = parseInt(a, 10) || 0;
        const nB = parseInt(b, 10) || 0;
        return nA !== nB ? nA - nB : a.localeCompare(b);
      });
  const periodLabel = isMonthly ? "Monthly Fees" : "Term Fees";
  const emptyItem: TermFeeItem = { amount: 0, paidAmount: 0, penaltyAmount: 0, paymentStatus: "Unpaid" };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup label="Student Name">
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Admission Number">
          <input type="text" value={form.admissionNumber} onChange={(e) => set("admissionNumber", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Class">
          <input type="text" value={form.class} onChange={(e) => set("class", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Section">
          <input type="text" value={form.section} onChange={(e) => set("section", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Roll No">
          <input type="text" value={form.rollNo} onChange={(e) => set("rollNo", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Phone Number">
          <input type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        <FieldGroup label="Email">
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} style={inputStyle} />
        </FieldGroup>
        {isTransport && !isMonthly && (
          <>
            <FieldGroup label="Boarding Point">
              <input type="text" value={form.pickupLocation ?? ""} onChange={(e) => set("pickupLocation", e.target.value)} placeholder="e.g. Kukatpally Bus Stop" className={inputClass} style={inputStyle} />
            </FieldGroup>
            <FieldGroup label="Drop Point">
              <input type="text" value={form.dropLocation ?? ""} onChange={(e) => set("dropLocation", e.target.value)} placeholder="e.g. School Gate" className={inputClass} style={inputStyle} />
            </FieldGroup>
          </>
        )}
      </div>

      {periodNames.length > 0 && (
        <div className="border-t pt-4" style={{ borderColor: "var(--app-divider)" }}>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
            {periodLabel}
          </h3>
          {isMonthly && (
            <p className="mb-3 text-xs" style={{ color: "var(--app-text-secondary)" }}>
              Set an amount on a month to add it to this student&apos;s bill. A
              past month&apos;s amount is fixed and can&apos;t be edited; the
              current and upcoming months can still be revised.
              {isTransport ? " Boarding/drop can differ by month." : ""}
            </p>
          )}
          <div className="space-y-3">
            {periodNames.map((periodName) => {
              const term = form.termFees[periodName] ?? emptyItem;
              const feeExists = Boolean(term.feeId);
              // Term amounts are immutable once added. Monthly amounts lock
              // only after the month has elapsed; current/upcoming months stay
              // editable, and not-yet-billed months can be added.
              const amountLocked = isMonthly
                ? feeExists && isPastAcademicMonth(form.academicYear, periodName)
                : feeExists;
              return (
                <div
                  key={periodName}
                  className={`grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:items-end ${isMonthly && isTransport ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}
                  style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-search-bg)" }}
                >
                  <div className="flex items-end text-sm font-medium lg:pb-2.5" style={{ color: "var(--app-text-primary)" }}>
                    {periodName}
                  </div>
                  <FieldGroup label="Amount">
                    <input
                      type="number"
                      value={term.originalAmount ?? term.amount}
                      onChange={(e) => setTermFee(periodName, "originalAmount", Number(e.target.value))}
                      disabled={amountLocked}
                      readOnly={amountLocked}
                      title={
                        amountLocked
                          ? isMonthly
                            ? "This month has passed — its fee amount is fixed and cannot be edited."
                            : "Term fee amount is fixed once added and cannot be edited."
                          : undefined
                      }
                      className={`${inputClass} ${amountLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      style={inputStyle}
                    />
                  </FieldGroup>
                  <FieldGroup label="Paid Amount">
                    <input
                      type="number"
                      value={term.paidAmount}
                      onChange={(e) => setTermFee(periodName, "paidAmount", Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldGroup>
                  <FieldGroup label="Status">
                    <SelectMenu
                      aria-label={`${periodName} payment status`}
                      value={term.paymentStatus || "Unpaid"}
                      onChange={(value) => setTermFee(periodName, "paymentStatus", value)}
                      usePortal={false}
                      className="w-full"
                      options={[
                        { value: "Paid", label: "Paid" },
                        { value: "Unpaid", label: "Unpaid" },
                        { value: "Partial", label: "Partial" },
                      ]}
                    />
                  </FieldGroup>
                  {isMonthly && isTransport && (
                    <>
                      <FieldGroup label="Boarding">
                        <input
                          type="text"
                          value={term.pickupLocation ?? ""}
                          onChange={(e) => setTermFee(periodName, "pickupLocation", e.target.value)}
                          placeholder="e.g. Kukatpally"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </FieldGroup>
                      <FieldGroup label="Drop">
                        <input
                          type="text"
                          value={term.dropLocation ?? ""}
                          onChange={(e) => setTermFee(periodName, "dropLocation", e.target.value)}
                          placeholder="e.g. School Gate"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </FieldGroup>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
}

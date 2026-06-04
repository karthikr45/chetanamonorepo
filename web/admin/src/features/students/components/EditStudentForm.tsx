"use client";

import { useState, useEffect } from "react";
import { SelectMenu } from "@/components/common";
import { useAuth } from "@/features/auth";
import type { StudentFeeRow, TermFeeItem } from "@/features/students/types";

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

  const termNames = Object.keys(form.termFees).sort((a, b) => {
    const nA = parseInt(a, 10) || 0;
    const nB = parseInt(b, 10) || 0;
    return nA !== nB ? nA - nB : a.localeCompare(b);
  });

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
        {isTransport && (
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

      {termNames.length > 0 && (
        <div className="border-t pt-4" style={{ borderColor: "var(--app-divider)" }}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--app-text-secondary)" }}>
            Term Fees
          </h3>
          <div className="space-y-3">
            {termNames.map((termName) => {
              const term = form.termFees[termName];
              return (
                <div
                  key={termName}
                  className="grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
                  style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-search-bg)" }}
                >
                  <div className="flex items-end text-sm font-medium lg:pb-2.5" style={{ color: "var(--app-text-primary)" }}>
                    {termName}
                  </div>
                  <FieldGroup label="Amount">
                    <input
                      type="number"
                      value={term.amount}
                      onChange={(e) => setTermFee(termName, "amount", Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldGroup>
                  <FieldGroup label="Paid Amount">
                    <input
                      type="number"
                      value={term.paidAmount}
                      onChange={(e) => setTermFee(termName, "paidAmount", Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldGroup>
                  {/* <FieldGroup label="Paid Amount">
                    <input
                      type="number"
                      value={term.paidAmount}
                      onChange={(e) => setTermFee(termName, "paidAmount", Number(e.target.value))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldGroup> */}
                  <FieldGroup label="Status">
                    <SelectMenu
                      aria-label={`${termName} payment status`}
                      value={term.paymentStatus || "Unpaid"}
                      onChange={(value) => setTermFee(termName, "paymentStatus", value)}
                      usePortal={false}
                      className="w-full"
                      options={[
                        { value: "Paid", label: "Paid" },
                        { value: "Unpaid", label: "Unpaid" },
                        { value: "Partial", label: "Partial" },
                      ]}
                    />
                  </FieldGroup>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common";
import type { StudentFeeRow } from "@/features/students/types";

function ReceiptIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}

export interface ReceiptDropdownProps {
  student: StudentFeeRow;
  academicYear: string;
}

export function ReceiptDropdown({ student, academicYear }: ReceiptDropdownProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("");

  const allTerms = Object.entries(student.termFees);
  const paidTerms = allTerms.filter(([, t]) => t.paymentStatus === "Paid");
  const disabled = paidTerms.length === 0;

  const handleOpen = () => {
    setSelectedTerm(paidTerms.length > 0 ? paidTerms[0][0] : "");
    setModalOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedTerm) return;
    setModalOpen(false);
    const params = new URLSearchParams({
      studentId: student.admissionNumber,
      term: selectedTerm,
      academicYear,
    });
    router.push(`/view/receipt?${params.toString()}`);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-[background-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--app-nav-hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{ color: disabled ? "var(--app-text-secondary)" : "var(--app-brand)" }}
        title={disabled ? "No paid terms" : "View receipt"}
        aria-label="View receipt"
      >
        <ReceiptIcon />
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Select Term"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-10 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)] cursor-pointer"
              style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedTerm}
              className="h-10 rounded-lg px-5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              View Receipt
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
            Select which term receipt to view for <strong style={{ color: "var(--app-text-primary)" }}>{student.name}</strong>
          </p>
          <div
            className="max-h-[min(50vh,260px)] space-y-2 overflow-y-auto overscroll-contain rounded-xl border p-2"
            style={{ borderColor: "var(--app-search-border)", backgroundColor: "var(--app-search-bg)" }}
            role="listbox"
            aria-label="Paid terms"
          >
            {paidTerms.map(([termName]) => {
              const selected = selectedTerm === termName;
              return (
                <button
                  key={termName}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedTerm(termName)}
                  className={
                    "flex min-h-12 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition-colors cursor-pointer " +
                    (selected ? "bg-[var(--app-nav-hover-bg)]" : "hover:bg-[var(--app-nav-hover-bg)]")
                  }
                  style={{ color: "var(--app-text-primary)" }}
                >
                  {termName}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}

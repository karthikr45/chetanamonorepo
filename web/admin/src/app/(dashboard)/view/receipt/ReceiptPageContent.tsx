"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { StatusBadge } from "@/components/common";
import { getStudentByAdmission } from "@/features/students/services/students.service";
import type { StudentFeeRow } from "@/features/students/types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Divider() {
  return <hr className="my-0" style={{ borderColor: "var(--app-divider)" }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
      {children}
    </h3>
  );
}

function formatDate(d?: string | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(n?: number): string {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ReceiptPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const receiptRef = useRef<HTMLDivElement>(null);

  const admissionNumber = searchParams.get("studentId") ?? "";
  const termName = searchParams.get("term") ?? "";
  const academicYear = searchParams.get("academicYear") ?? "";

  const [student, setStudent] = useState<StudentFeeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admissionNumber || !academicYear) {
      setError("Missing admission number or academic year.");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getStudentByAdmission(admissionNumber, academicYear);
        setStudent(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load student data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [admissionNumber, academicYear]);

  const term = student?.termFees?.[termName] ?? null;

  const handleDownload = () => {
    const el = receiptRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt – ${student?.name ?? "Student"} – ${termName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #18181b; }
            .receipt { max-width: 700px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #e4e4e7; padding-bottom: 20px; }
            .header h1 { font-size: 20px; margin-bottom: 4px; }
            .header p { color: #71717a; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 2px; }
            .field span { font-size: 14px; font-weight: 500; }
            .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e4e4e7; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
            .paid { background: #dcfce7; color: #16a34a; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e4e4e7; color: #71717a; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Payment Receipt</h1>
              <p>${termName} • ${academicYear}</p>
            </div>
            <div class="section-title">Student Details</div>
            <div class="grid">
              <div class="field"><label>Student Name</label><span>${student?.name ?? "—"}</span></div>
              <div class="field"><label>Admission No</label><span>${student?.admissionNumber ?? "—"}</span></div>
              <div class="field"><label>Class</label><span>${student?.class ?? "—"}</span></div>
              <div class="field"><label>Section</label><span>${student?.section ?? "—"}</span></div>
              <div class="field"><label>Roll No</label><span>${student?.rollNo ?? "—"}</span></div>
              <div class="field"><label>Phone</label><span>${student?.phone ?? "—"}</span></div>
              <div class="field"><label>Email</label><span>${student?.email ?? "—"}</span></div>
            </div>
            <div class="section-title">Payment Details</div>
            <div class="grid3">
              <div class="field"><label>Term</label><span>${termName}</span></div>
              <div class="field"><label>Amount</label><span>${formatCurrency(term?.amount)}</span></div>
              <div class="field"><label>Paid Amount</label><span>${formatCurrency(term?.paidAmount)}</span></div>
              <div class="field"><label>Status</label><span class="badge paid">${term?.paymentStatus ?? "—"}</span></div>
              <div class="field"><label>Receipt ID</label><span>REC-${student?.id ?? "000"}-${termName.replace(/\s+/g, "")}</span></div>
              <div class="field"><label>Payment Date</label><span>${formatDate(new Date().toISOString())}</span></div>
            </div>
            <div class="footer">This is a computer-generated receipt and does not require a signature.</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p style={{ color: "var(--app-text-secondary)" }}>Loading receipt...</p>
      </div>
    );
  }

  if (error || !student || !term) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--app-brand)" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Students
        </button>
        <div className="flex h-48 items-center justify-center rounded-xl border" style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-card-bg)" }}>
          <p style={{ color: "var(--app-danger)" }}>{error ?? "Student or term not found."}</p>
        </div>
      </div>
    );
  }

  const receiptId = student._id;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--app-brand)" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Students
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "var(--app-brand)" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Receipt
        </button>
      </div>

      {/* Receipt Card */}
      <div
        ref={receiptRef}
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border shadow-[var(--app-card-shadow)]"
        style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
      >
        {/* Receipt header */}
        <div
          className="px-8 py-6 text-center"
          style={{ background: "linear-gradient(135deg, var(--app-brand), #1e40af)" }}
        >
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Payment Receipt</h1>
          <p className="mt-1 text-sm text-white/70">{termName} • {academicYear}</p>
        </div>

        {/* Status + Receipt ID bar */}
        <div
          className="flex items-center justify-between border-b px-8 py-3"
          style={{ borderColor: "var(--app-divider)", backgroundColor: "var(--app-search-bg)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--app-text-secondary)" }}>
              Receipt ID
            </span>
            <span className="rounded-md bg-[var(--app-nav-hover-bg)] px-2 py-0.5 text-xs font-mono font-semibold" style={{ color: "var(--app-text-primary)" }}>
              {receiptId}
            </span>
          </div>
          <StatusBadge variant="success">{term.paymentStatus}</StatusBadge>
        </div>

        <div className="space-y-6 px-8 py-6">
          {/* Student details */}
          <div>
            <SectionTitle>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Student Details
            </SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <InfoRow label="Student Name" value={student.name} />
              <InfoRow label="Admission No" value={student.admissionNumber} />
              <InfoRow label="Class / Section" value={`${student.class} – ${student.section}`} />
              <InfoRow label="Roll No" value={student.rollNo} />
              <InfoRow label="Phone" value={student.phone} />
              <InfoRow label="Email" value={student.email} />
            </div>
          </div>

          <Divider />

          {/* Payment details */}
          <div>
            <SectionTitle>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Payment Details
            </SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <InfoRow label="Term" value={termName} />
              <InfoRow label="Fee Amount" value={formatCurrency(term.amount)} />
              <InfoRow label="Paid Amount" value={formatCurrency(term.paidAmount)} />
              <InfoRow label="Balance" value={formatCurrency(term.amount - term.paidAmount)} />
              <InfoRow label="Payment Date" value={formatDate(new Date().toISOString())} />
              <InfoRow label="Receipt ID" value={receiptId} />
            </div>
          </div>

          <Divider />

          {/* Payer details */}
          <div>
            <SectionTitle>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Payer Details
            </SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <InfoRow label="Payer Name" value={student.name} />
              <InfoRow label="Contact" value={student.phone} />
              <InfoRow label="Email" value={student.email} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="border-t px-8 py-4 text-center text-xs"
          style={{ borderColor: "var(--app-divider)", color: "var(--app-text-secondary)" }}
        >
          This is a computer-generated receipt and does not require a signature.
        </div>
      </div>
    </div>
  );
}

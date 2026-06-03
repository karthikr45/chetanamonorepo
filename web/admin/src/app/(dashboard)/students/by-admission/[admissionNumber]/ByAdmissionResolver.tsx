"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import { listEnrollmentsByAdmissionApi } from "@/features/student-identities/api/student-identities.api";
import { get } from "@/lib/api-client";

interface RowShape {
  id: string;
  identityId: string | null;
  admissionNumber: string;
  academicYear: string;
  name?: string;
  class?: string;
  section?: string;
}

/**
 * Resolver page: takes an admission number, walks identity_id, and
 * redirects to /students/identity/<id>. Used as the "Profile / TC"
 * entry point from the existing students table — we don't want to
 * couple the list response to include identity_id, so we resolve
 * lazily here.
 *
 * Falls back to a "no identity linked yet" message if the legacy
 * student row predates the identity backfill.
 */
export function ByAdmissionResolver({
  admissionNumber,
}: {
  admissionNumber: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "no-identity"; row: RowShape | null }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // First try the canonical helper.
        const { enrollments } = await listEnrollmentsByAdmissionApi(admissionNumber);
        if (cancelled) return;
        const withIdentity = enrollments.find(
          (e) => (e as unknown as RowShape).identityId,
        );
        if (withIdentity) {
          const id = (withIdentity as unknown as RowShape).identityId!;
          router.replace(`/students/identity/${id}`);
          return;
        }
        // Fallback: maybe legacy data — show a friendly explanation.
        // Try the older lookup so we can at least show the row.
        let row: RowShape | null = null;
        try {
          const res = (await get(
            `/students/by-admission/with-fees?admissionNumber=${encodeURIComponent(admissionNumber)}&academicYear=`,
          )) as { data?: { student?: RowShape } };
          row = res?.data?.student ?? null;
        } catch {
          /* ignore */
        }
        if (!cancelled) setState({ kind: "no-identity", row });
      } catch (e) {
        if (!cancelled)
          setState({
            kind: "error",
            message: getApiErrorMessage(e, "Could not resolve student"),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admissionNumber, router]);

  if (state.kind === "loading") {
    return (
      <div className="p-6 sm:p-8 max-w-[700px] mx-auto">
        <p className="text-sm text-slate-500">Looking up student…</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="p-6 sm:p-8 max-w-[700px] mx-auto">
        <Card padding="default">
          <p className="text-sm text-red-700">{state.message}</p>
          <Link href="/students" className="text-sm text-[#6c739c] hover:underline mt-3 inline-block">
            ← Back to Students
          </Link>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-6 sm:p-8 max-w-[700px] mx-auto">
      <Card padding="default">
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          No identity linked yet
        </h1>
        <p className="text-sm text-slate-600 mb-3">
          Admission <span className="font-mono font-semibold">{admissionNumber}</span>{" "}
          exists, but it predates the identity feature. A super-admin needs to
          run the one-time backfill before this student can be opened in the
          Profile / TC view.
        </p>
        <p className="text-xs text-slate-500 mb-4">
          As a super-admin, hit <code className="font-mono">POST /api/student-identities/backfill</code>{" "}
          once. New students created after that point are automatically linked.
        </p>
        <Link href="/students" className="text-sm text-[#6c739c] hover:underline">
          ← Back to Students
        </Link>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getLatestStudentsApi } from "@/features/students/api/students.api";
import type { LatestStudent } from "@/features/students/types";

function Avatar({ name, imgUrl }: { name: string; imgUrl: string | null }) {
  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={name}
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--app-brand,#6c739c)] text-xs font-bold text-white shadow-sm">
      {initials}
    </div>
  );
}

const HEADERS = [
  { label: "NAME",            key: "name"            },
  { label: "BRANCH",          key: "branch"          },
  { label: "ADMISSION NO.",   key: "admissionNumber" },
  { label: "ACADEMIC YEAR",   key: "academicYear"    },
  { label: "EMAIL",           key: "email"           },
  { label: "PHONE",           key: "phoneNumber"     },
  { label: "CLASS",           key: "class"           },
  { label: "SECTION",         key: "section"         },
  { label: "ROLL NO.",        key: "rollNo"          },
] as const;

export function RecentStudentsTable() {
  const [students, setStudents] = useState<LatestStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLatestStudentsApi()
      .then((res: any) => setStudents(res.data))
      .catch(() => setError("Failed to load recent students."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-[var(--app-card-radius)] border border-[var(--app-card-border)] bg-[var(--app-card-bg)] shadow-[var(--app-card-shadow)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--app-divider)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text-primary)]">
            Recent Students
          </h2>
          <p className="text-xs text-[var(--app-text-secondary)] mt-0.5">
            Latest 5 students added to your tenant
          </p>
        </div>
        <a
          href="/students"
          className="text-xs font-semibold text-[var(--app-brand)] hover:underline self-start sm:self-auto"
        >
          View all →
        </a>
        {/* <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[var(--app-search-border)] bg-[var(--app-card-bg)] text-[var(--app-nav-icon)] transition-colors hover:bg-[var(--app-nav-hover-bg)]"
            aria-label="Add Filters"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[var(--app-search-border)] bg-[var(--app-card-bg)] text-[var(--app-nav-icon)] transition-colors hover:bg-[var(--app-nav-hover-bg)]"
            aria-label="More options"
          >
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div> */}
      </div>

      {loading && (
        <div className="flex items-center justify-center px-6 py-10 text-sm text-[var(--app-text-secondary)]">
          Loading...
        </div>
      )}

      {error && !loading && (
        <div className="px-6 py-10 text-center text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && students.length === 0 && (
        <div className="px-6 py-10 text-center text-sm text-[var(--app-text-secondary)]">
          No recent students found.
        </div>
      )}

      {!loading && !error && students.length > 0 && (
        <>
          {/* Mobile card list — shown below sm */}
          <div className="sm:hidden divide-y divide-[var(--app-divider)]">
            {students.map((student) => (
              <div key={student.id} className="flex items-start gap-3 px-4 py-4">
                <Avatar name={student.name} imgUrl={student.imgUrl} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate font-medium text-[var(--app-text-primary)]">{student.name}</p>
                  <p className="text-xs text-[var(--app-text-secondary)]">Admission: {student.admissionNumber} &bull; Roll: {student.rollNo}</p>
                  <p className="text-xs text-[var(--app-text-secondary)]">Branch: {student.branch} &bull; Class: {student.class} &bull; Section: {student.section}</p>
                  <p className="text-xs text-[var(--app-text-secondary)]">Year: {student.academicYear}</p>
                  <p className="text-xs text-[var(--app-text-secondary)] truncate">{student.email}</p>
                  <p className="text-xs text-[var(--app-text-secondary)]">{student.phoneNumber}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table — shown from sm up */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  {HEADERS.map(({ label }) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-5 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-slate-50 transition-colors ${i !== students.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={student.name} imgUrl={student.imgUrl} />
                        <span className="font-semibold text-[var(--app-text-primary)]">{student.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)]">{student.branch}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums">{student.admissionNumber}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums">{student.academicYear}</td>
                    <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">{student.email}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums">{student.phoneNumber}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)]">{student.class}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)]">{student.section}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums">{student.rollNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

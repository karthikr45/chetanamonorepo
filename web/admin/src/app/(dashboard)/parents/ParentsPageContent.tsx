"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createParentApi,
  deleteParentApi,
  listParentsApi,
} from "@/features/parents/api/parents.api";
import type { CreateParentInput, Parent } from "@/features/parents/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";

const EMPTY_FORM: CreateParentInput = {
  name: "",
  email: "",
  phoneNumber: "",
  isActive: true,
  students: [
    { admissionNumber: "", relationship: "guardian", isPrimary: true },
  ],
};

export function ParentsPageContent() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateParentInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listParentsApi()
      .then((data) => setParents(data))
      .catch((err) => setError(getApiErrorMessage(err, "Could not load parents")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function updateStudent(
    i: number,
    patch: Partial<CreateParentInput["students"][number]>,
  ) {
    setForm((f) => ({
      ...f,
      students: f.students.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }

  function addStudentRow() {
    setForm((f) => ({
      ...f,
      students: [
        ...f.students,
        { admissionNumber: "", relationship: "guardian", isPrimary: false },
      ],
    }));
  }

  function removeStudentRow(i: number) {
    setForm((f) => ({
      ...f,
      students: f.students.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    if (form.students.some((s) => !s.admissionNumber.trim())) {
      setFormError("Every student row needs an admission number.");
      return;
    }
    setSubmitting(true);
    try {
      await createParentApi(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Could not create parent"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this parent? This cannot be undone.")) return;
    try {
      await deleteParentApi(id);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete parent"));
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Parents" },
        ]}
        title="Parents"
        subtitle="Manage parent accounts and link them to their children's admission numbers. Parents log in with OTP and only see records for the students they're linked to."
        meta={
          !loading && (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 tabular-nums">
              {parents.length}
            </span>
          )
        }
        actions={
          <Button
            onClick={() => setShowForm((s) => !s)}
            variant={showForm ? "outline" : "primary"}
            size="md"
          >
            {showForm ? (
              "Cancel"
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add parent
              </>
            )}
          </Button>
        }
      />

      {showForm && (
        <Card padding="default" className="mb-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                  required
                  placeholder="Ramesh Kumar"
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="form-input"
                  required
                  placeholder="parent@example.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phoneNumber ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, phoneNumber: e.target.value })
                  }
                  className="form-input"
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.value === "true" })
                  }
                  className="form-input"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[var(--app-text-primary)]">
                  Linked children
                </p>
                <button
                  type="button"
                  onClick={addStudentRow}
                  className="text-xs font-semibold text-[var(--app-brand)] hover:underline"
                >
                  + Add another
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {form.students.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <input
                      placeholder="Admission no."
                      value={s.admissionNumber}
                      onChange={(e) =>
                        updateStudent(i, { admissionNumber: e.target.value })
                      }
                      className="form-input form-input-tight sm:col-span-6"
                    />
                    <select
                      value={s.relationship}
                      onChange={(e) =>
                        updateStudent(i, {
                          relationship: e.target.value as
                            | "father"
                            | "mother"
                            | "guardian",
                        })
                      }
                      className="form-input form-input-tight sm:col-span-2"
                    >
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 sm:col-span-2 px-1">
                      <input
                        type="checkbox"
                        checked={!!s.isPrimary}
                        onChange={(e) =>
                          updateStudent(i, { isPrimary: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[var(--app-brand)] focus:ring-[var(--app-brand)]"
                      />
                      Primary
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeStudentRow(i)}
                        disabled={form.students.length === 1}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={submitting}>
                Save parent
              </Button>
            </div>

            <style jsx>{`
              :global(.form-input) {
                height: 42px;
                padding: 0 14px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                background: #ffffff;
                font-size: 14px;
                color: #0f172a;
                outline: none;
                width: 100%;
                transition: border-color 0.15s, box-shadow 0.15s;
              }
              :global(.form-input:focus) {
                border-color: var(--app-brand);
                box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
              }
              :global(.form-input::placeholder) {
                color: #94a3b8;
              }
              :global(.form-input-tight) {
                height: 38px;
                font-size: 13px;
              }
            `}</style>
          </form>
        </Card>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <SkeletonRows />
        ) : parents.length === 0 ? (
          <EmptyState onCreate={() => setShowForm(true)} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Children</Th>
                <Th>Status</Th>
                <Th align="right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p, i) => (
                <tr
                  key={p.id}
                  className={`hover:bg-slate-50 transition-colors ${i !== parents.length - 1 ? "border-b border-slate-50" : ""}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div className="font-semibold text-[var(--app-text-primary)]">
                        {p.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[var(--app-text-secondary)]">
                    {p.email}
                  </td>
                  <td className="px-5 py-4 text-[var(--app-text-secondary)] tabular-nums">
                    {p.phoneNumber ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    {(p.studentLinks ?? []).length === 0 ? (
                      <span className="text-[var(--app-text-muted)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(p.studentLinks ?? []).map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 tabular-nums"
                          >
                            {l.admissionNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge active={p.isActive} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
        {label}{" "}
        {required && <span className="text-red-500 normal-case">*</span>}
      </span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] bg-slate-50/60`}
    >
      {children}
    </th>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: "var(--app-brand)" }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="p-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-3 w-1/4 bg-slate-100 rounded animate-pulse" />
            <div className="h-2.5 w-1/3 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="text-slate-500"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6M23 11h-6" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
        No parents yet
      </h3>
      <p className="mt-1 text-sm text-[var(--app-text-secondary)] max-w-sm">
        Add a parent and link them to their child's admission number to enable
        OTP login on the parent portal.
      </p>
      <Button onClick={onCreate} variant="primary" size="md" className="mt-4">
        Add your first parent
      </Button>
    </div>
  );
}

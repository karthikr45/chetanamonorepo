"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/features/auth";
import {
  createTenantUserApi,
  deleteTenantUserApi,
  listTenantUsersApi,
  updateTenantUserApi,
  TENANT_USER_ROLES,
  type CreateTenantUserBody,
  type TenantUserRow,
  type UpdateTenantUserBody,
} from "@/features/tenant-users/api/tenant-users.api";
import { listSystemMetadataApi } from "@/features/system-metadata/api/system-metadata.api";

type RoleOption = { value: string; label: string; help?: string };

type EditState =
  | { mode: "create" }
  | { mode: "edit"; row: TenantUserRow };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  fin_admin: "Finance Admin",
  ops_admin: "Operations Admin",
  super_admin: "Super Admin",
};

export function UsersPageContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TenantUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(
    TENANT_USER_ROLES.map((r) => ({ value: r.value, label: r.label, help: r.help })),
  );

  useEffect(() => {
    let cancelled = false;
    listSystemMetadataApi({ type: "admin_role", activeOnly: true })
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : (((res as any)?.data ?? []) as Array<Record<string, unknown>>);
        const opts: RoleOption[] = list
          .filter((r) => typeof r.value === "string" && r.value)
          .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
          .map((r) => ({
            value: String(r.value),
            label: String(r.label ?? r.value),
            help:
              TENANT_USER_ROLES.find((t) => t.value === r.value)?.help ?? undefined,
          }));
        if (!cancelled && opts.length > 0) setRoleOptions(opts);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listTenantUsersApi()
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : (((res as any)?.data ?? []) as TenantUserRow[]);
        setRows(list);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load users")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] mx-auto">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Users & Roles
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Manage who can access this tenant. Add finance or operations admins
            so day-to-day work doesn’t require sharing the primary admin login.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setEdit({ mode: "create" })}
          >
            + Add user
          </Button>
        )}
      </header>

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-800">
          You can view users in this tenant, but only the tenant admin can add or edit them.
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">
            No users yet. Click <strong>Add user</strong> to invite the first one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th align="right">{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 ${
                    i !== rows.length - 1 ? "border-b border-slate-50" : ""
                  }`}
                >
                  <td className="px-5 py-3.5 font-semibold text-slate-900">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{r.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-[0.06em] bg-[#f7ece9] text-[#6c739c]">
                      {ROLE_LABEL[r.role] ?? r.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEdit({ mode: "edit", row: r })}
                          className="text-xs font-semibold text-[#6c739c] hover:underline"
                        >
                          Edit
                        </button>
                        {r.id !== user?.id && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete ${r.firstName} ${r.lastName}?`)) return;
                              try {
                                await deleteTenantUserApi(r.id);
                                load();
                              } catch (err) {
                                setError(getApiErrorMessage(err, "Could not delete"));
                              }
                            }}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {edit && (
        <UserEditDialog
          state={edit}
          roleOptions={roleOptions}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
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
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}

function UserEditDialog({
  state,
  roleOptions,
  onClose,
  onSaved,
}: {
  state: EditState;
  roleOptions: RoleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = state.mode === "edit";
  const existing = isEdit ? state.row : null;

  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<string>(
    existing?.role ?? roleOptions[0]?.value ?? "fin_admin",
  );
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const roleHelp = useMemo(
    () => roleOptions.find((r) => r.value === role)?.help ?? "",
    [role, roleOptions],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErr("First name, last name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        const body: UpdateTenantUserBody = {
          firstName,
          lastName,
          role,
          isActive,
        };
        if (password.trim()) body.password = password.trim();
        await updateTenantUserApi(existing.id, body);
      } else {
        const body: CreateTenantUserBody = {
          firstName,
          lastName,
          email: email.trim(),
          role,
        };
        if (password.trim()) body.password = password.trim();
        await createTenantUserApi(body);
      }
      onSaved();
    } catch (e2) {
      setErr(getApiErrorMessage(e2, "Could not save user"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Edit user" : "Add user"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name *">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="form-input-x"
              />
            </Field>
            <Field label="Last name *">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="form-input-x"
              />
            </Field>
          </div>

          <Field label="Email *">
            <input
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input-x"
              placeholder="user@school.com"
            />
            {isEdit && (
              <p className="text-[11px] text-slate-400 mt-1">
                Email cannot be changed.
              </p>
            )}
          </Field>

          <Field label="Role *">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input-x"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {roleHelp && (
              <p className="text-xs text-slate-500 mt-1">{roleHelp}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Need a different role? Ask the super-admin to add it under
              System Metadata → <code>admin_role</code>.
            </p>
          </Field>

          <Field
            label={isEdit ? "New password (optional)" : "Initial password (optional)"}
          >
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input-x"
              placeholder="Leave blank for system default"
            />
          </Field>

          {isEdit && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              Active
            </label>
          )}

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              {isEdit ? "Save changes" : "Create user"}
            </Button>
          </div>
        </form>

        <style jsx>{`
          :global(.form-input-x) {
            height: 38px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #fff;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            width: 100%;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input-x:focus) {
            border-color: #6c739c;
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
          :global(.form-input-x:disabled) {
            background: #f1f5f9;
            color: #64748b;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

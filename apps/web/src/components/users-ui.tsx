// Shared users list + detail cards for /admin/users (platform) and /m/team
// (merchant). The list is a clean list view — search, filters, pager, ⚙ into
// the detail page; every action lives on the detail page.

import Link from "next/link";
import {
  createUser,
  toggleUser,
  resetUserPassword,
  setUserRole,
  deleteUser,
} from "@/app/actions/access";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import type { Merchant, Role, User } from "@/lib/types";

export type UserRow = User & { role: Role | null; merchant: Merchant | null };

export function UsersList({
  base,
  title,
  subtitle,
  noun,
  rows,
  total,
  isMerchant,
  canAdd,
  filters,
  pagination,
  error,
}: {
  base: string;
  title: string;
  subtitle: string;
  noun: string;
  rows: UserRow[];
  total: number;
  isMerchant: boolean;
  canAdd: boolean;
  filters?: React.ReactNode;
  pagination?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {canAdd && (
          <Link
            href={`${base}/new`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New {noun}
          </Link>
        )}
      </div>
      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>
      )}

      <TableToolbar count={total} noun="user">
        {filters}
      </TableToolbar>

      <Table head={["Username", "Name", "Role", ...(isMerchant ? [] : ["White Label"]), "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={isMerchant ? 5 : 6} className="px-4 py-6 text-sm text-muted">
              No users match these filters.
            </td>
          </tr>
        )}
        {rows.map((u) => (
          <tr key={u.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 font-medium">
              {u.username}
              {u.is_superadmin && (
                <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">Superadmin</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-muted">{u.name || "—"}</td>
            <td className="px-4 py-2.5 text-muted">{u.role?.name ?? (u.is_superadmin ? "—" : "No role")}</td>
            {!isMerchant && <td className="px-4 py-2.5 text-muted">{u.merchant?.name ?? "Platform"}</td>}
            <td className="px-4 py-2.5">
              <ActiveTag active={u.active} />
              {u.must_change_password && <p className="mt-1 text-[10px] text-muted">first login pending</p>}
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`${base}/${u.id}`} tip={`Open ${u.username}`} />
            </td>
          </tr>
        ))}
      </Table>

      {pagination}
    </div>
  );
}

/** Detail-page cards: account info + every management action. */
export function UserDetail({
  base,
  user,
  roles,
  selfId,
  isSuper,
}: {
  base: string;
  user: UserRow;
  roles: Role[]; // assignable for this account's side
  selfId: string;
  isSuper: boolean;
}) {
  const back = `${base}/${user.id}`;
  const managed = user.id !== selfId && (!user.is_superadmin || isSuper);
  const assignable = roles.filter((r) => (user.merchant_id ? r.level === "merchant" : r.level === "platform"));

  return (
    <div className="space-y-5">
      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Username</p>
          <p className="mono-num mt-1 font-medium">
            {user.username}
            {user.is_superadmin && (
              <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">Superadmin</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Name</p>
          <p className="mt-1">{user.name || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">{user.merchant ? "White Label" : "Belongs To"}</p>
          <p className="mt-1">{user.merchant?.name ?? "Platform"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Status</p>
          <p className="mt-1">
            <ActiveTag active={user.active} />
            {user.must_change_password && <span className="ml-2 text-xs text-muted">first login pending</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Created</p>
          <p className="mono-num mt-1 text-muted">{user.created_at?.slice(0, 10) ?? "—"}</p>
        </div>
      </section>

      {!managed && (
        <p className="text-sm text-muted">
          {user.id === selfId ? "This is your own account — manage it under My Profile." : "Only a superadmin can manage this account."}
        </p>
      )}

      {managed && (
        <>
          {!user.is_superadmin && (
            <section className="card space-y-3 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Role</h2>
              <form action={setUserRole} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="back" value={back} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Assigned role</label>
                  <select name="role_id" defaultValue={user.role_id ?? ""} className="input w-auto">
                    {assignable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ActionButton icon="check" tip="Apply this role" label="Apply" variant="primary" />
              </form>
            </section>
          )}

          <section className="card space-y-3 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Reset Password</h2>
            <form action={resetUserPassword} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="back" value={back} />
              <div>
                <label className="mb-1 block text-xs text-muted">New password</label>
                <input name="password" type="text" autoComplete="off" className="input w-56" required />
              </div>
              <ActionButton icon="key" tip="Set the new password — they must change it at next login" label="Reset" />
            </form>
            <p className="text-xs text-muted">They will be asked to choose their own password at the next sign-in.</p>
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {user.active ? "Deactivate" : "Activate"}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {user.active ? "A deactivated account cannot sign in." : "Let this account sign in again."}
              </p>
            </div>
            <form action={toggleUser}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="active" value={String(!user.active)} />
              <ActionButton
                icon="power"
                tip={user.active ? "Deactivate this account" : "Activate this account"}
                label={user.active ? "Deactivate" : "Activate"}
              />
            </form>
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-3 border-danger/30 p-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-danger">Delete Account</h2>
              <p className="mt-1 text-xs text-muted">Removes the sign-in permanently. Records they created stay.</p>
            </div>
            <form action={deleteUser}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="back" value={base} />
              <ActionButton icon="trash" tip="Delete this account permanently" label="Delete" variant="danger" />
            </form>
          </section>
        </>
      )}
    </div>
  );
}

/** The + New form, shared by both sides. */
export function UserCreateForm({
  base,
  isMerchant,
  roles,
  merchants,
}: {
  base: string;
  isMerchant: boolean;
  roles: Role[];
  merchants: Merchant[];
}) {
  return (
    <form action={createUser} className="card grid max-w-2xl gap-4 p-5 sm:grid-cols-2">
      <input type="hidden" name="back" value={base} />
      <div>
        <label className="mb-1 block text-xs text-muted">Username</label>
        <input name="username" autoComplete="off" className="input mono-num" required />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Display Name</label>
        <input name="name" className="input" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Initial Password (changed at first login)</label>
        <input name="password" type="text" autoComplete="off" className="input mono-num" required />
      </div>
      {!isMerchant && (
        <div>
          <label className="mb-1 block text-xs text-muted">Belongs To</label>
          <select name="merchant_id" className="input">
            <option value="">Platform</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-muted">Role</label>
        <select name="role_id" className="input" required>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {!isMerchant ? `(${r.level === "merchant" ? "white label" : r.level})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <ActionButton icon="plus" tip="Create this user account" label="Create User" variant="primary" />
      </div>
      {!isMerchant && (
        <p className="text-xs text-muted sm:col-span-2">
          Platform users need a platform-level role; white label users need a white-label-level role.
        </p>
      )}
    </form>
  );
}

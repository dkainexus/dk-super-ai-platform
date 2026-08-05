// Shared users management UI for /admin/users (platform) and /m/team (merchant).

import { createUser, toggleUser, resetUserPassword, setUserRole, deleteUser } from "@/app/actions/access";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";
import { Table, TableToolbar } from "@/components/data-table";
import type { Merchant, Role, User } from "@/lib/types";

export type UserRow = User & { role: Role | null; merchant: Merchant | null };

export function UsersManager({
  users,
  total,
  roles,
  merchants,
  isMerchant,
  selfId,
  filters,
  pagination,
}: {
  users: UserRow[];
  /** Total matching rows (defaults to the page's length). */
  total?: number;
  roles: Role[]; // assignable roles
  merchants: Merchant[]; // platform side only: for the create form
  isMerchant: boolean;
  selfId: string;
  /** Filter controls for the toolbar, rendered by the page. */
  filters?: React.ReactNode;
  /** Pagination footer, rendered by the page under the table. */
  pagination?: React.ReactNode;
}) {
  const merchantRoles = roles.filter((r) => r.level === "merchant");
  const platformRoles = roles.filter((r) => r.level === "platform");

  return (
    <div className="space-y-5">
      <TableToolbar count={total ?? users.length} noun="user">
        {filters}
      </TableToolbar>

      <Table
        head={[
          "Username",
          "Name",
          "Role",
          ...(isMerchant ? [] : ["White Label"]),
          "Status",
          "",
        ]}
      >
        {users.length === 0 && (
          <tr>
            <td colSpan={isMerchant ? 5 : 6} className="px-4 py-6 text-sm text-muted">
              No users match these filters.
            </td>
          </tr>
        )}
        {users.map((u) => (
          <tr key={u.id} className="align-top transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 font-medium">
              {u.username}
              {u.is_superadmin && (
                <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">Superadmin</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-muted">{u.name || "—"}</td>
            <td className="px-4 py-2.5">
              {u.id !== selfId && !u.is_superadmin ? (
                <form action={setUserRole} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role_id" defaultValue={u.role_id ?? ""} className="input w-auto py-1 text-xs">
                    {(u.merchant_id ? merchantRoles : platformRoles).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <ActionButton icon="check" tip="Apply this role" />
                </form>
              ) : (
                <span className="text-muted">{u.role?.name ?? "No role"}</span>
              )}
            </td>
            {!isMerchant && <td className="px-4 py-2.5 text-muted">{u.merchant?.name ?? "Platform"}</td>}
            <td className="px-4 py-2.5">
              <ActiveTag active={u.active} />
              {u.must_change_password && (
                <p className="mt-1 text-[10px] text-muted">first login pending</p>
              )}
            </td>
            <td className="px-4 py-2.5">
              {u.id !== selfId && !u.is_superadmin && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <form action={resetUserPassword} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input
                      name="password"
                      type="text"
                      placeholder="New password"
                      autoComplete="off"
                      className="input w-28 py-1 text-xs"
                      required
                    />
                    <ActionButton icon="key" tip="Reset password (forces change at next login)" />
                  </form>
                  <form action={toggleUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={String(!u.active)} />
                    <ActionButton icon="power" tip={u.active ? "Deactivate this user" : "Activate this user"} />
                  </form>
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <ActionButton icon="trash" tip="Delete this user permanently" variant="danger" />
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {pagination}

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Create User</h2>
        <form action={createUser} className="grid gap-4 sm:grid-cols-3">
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
        </form>
        {!isMerchant && (
          <p className="mt-3 text-xs text-muted">
            Platform users need a platform-level role; white label users need a white-label-level role.
          </p>
        )}
      </section>
    </div>
  );
}

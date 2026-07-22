// Shared users management UI for /admin/users (platform) and /m/team (merchant).

import { createUser, toggleUser, resetUserPassword, setUserRole, deleteUser } from "@/app/actions/access";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";
import type { Merchant, Role, User } from "@/lib/types";

export type UserRow = User & { role: Role | null; merchant: Merchant | null };

export function UsersManager({
  users,
  roles,
  merchants,
  isMerchant,
  selfId,
}: {
  users: UserRow[];
  roles: Role[]; // assignable roles
  merchants: Merchant[]; // platform side only: for the create form
  isMerchant: boolean;
  selfId: string;
}) {
  const merchantRoles = roles.filter((r) => r.level === "merchant");
  const platformRoles = roles.filter((r) => r.level === "platform");

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-border">
        {users.length === 0 && <p className="px-5 py-6 text-sm text-muted">No users yet.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="mono-num text-sm font-medium">
                {u.username}
                {u.is_superadmin && (
                  <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Superadmin</span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {u.name || "—"} · {u.role?.name ?? "No role"}
                {!isMerchant && ` · ${u.merchant?.name ?? "Platform"}`}
                {u.must_change_password && " · first login pending"}
              </p>
            </div>
            {u.id !== selfId && !u.is_superadmin && (
              <div className="flex flex-wrap items-center gap-2">
                <ActiveTag active={u.active} />
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
                <form action={resetUserPassword} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <input name="password" type="text" placeholder="New password" autoComplete="off" className="input w-28 py-1 text-xs" required />
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
          </div>
        ))}
      </div>

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

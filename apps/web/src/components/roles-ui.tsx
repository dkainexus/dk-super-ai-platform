// Shared roles UI: list + permission matrix editor.
// Used by /admin/roles (platform) and /m/roles (merchant, scope-capped).

import Link from "next/link";
import { createRole, saveRolePermissions, deleteRole } from "@/app/actions/access";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { ACTIONS, type PermissionMap } from "@/lib/rbac";
import { MODULES } from "@/modules/registry";
import type { Role } from "@/lib/types";

export function RoleList({
  roles,
  base,
  isMerchant,
  userCounts,
}: {
  roles: Role[];
  base: string; // '/admin/roles' | '/m/roles'
  isMerchant: boolean;
  userCounts: Map<string, number>;
}) {
  return (
    <div className="space-y-6">
      <div className="card divide-y divide-border">
        {roles.length === 0 && <p className="px-5 py-6 text-sm text-muted">No roles yet.</p>}
        {roles.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {r.name}{" "}
                {r.is_system && (
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">System</span>
                )}
                {!isMerchant && (
                  <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                    {r.level === "merchant" ? "white label" : r.level}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {r.description || "—"} · {userCounts.get(r.id) ?? 0} user(s)
              </p>
            </div>
            {!r.is_system && (
              <Link
                href={`${base}/${r.id}`}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-accent-strong"
              >
                Edit Permissions →
              </Link>
            )}
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Create Role</h2>
        <form action={createRole} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" placeholder="e.g. Reviewer" className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <input name="description" className="input" />
          </div>
          {!isMerchant && (
            <div>
              <label className="mb-1 block text-xs text-muted">Level</label>
              <select name="level" className="input">
                <option value="platform">Platform</option>
                <option value="merchant">White Label</option>
              </select>
            </div>
          )}
          <ActionButton icon="plus" tip="Create this role, then set its permissions" label="Create" variant="primary" />
        </form>
      </section>
    </div>
  );
}

const SCOPE_LABEL: Record<string, string> = {
  off: "Off",
  own: "Own",
  merchant: "White Label",
  all: "All",
};

export function PermissionMatrix({
  role,
  perms,
  base,
  isMerchant,
}: {
  role: Role;
  perms: PermissionMap;
  base: string;
  isMerchant: boolean;
}) {
  // Merchant-side (or merchant-level) roles can never grant "all".
  const scopeOptions =
    isMerchant || role.level === "merchant" ? ["off", "own", "merchant"] : ["off", "own", "merchant", "all"];
  const visibleModules = MODULES.filter((m) => (isMerchant ? m.merchantNav : true));

  return (
    <form action={saveRolePermissions} className="space-y-6">
      <input type="hidden" name="role_id" value={role.id} />

      <section className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Role Name</label>
            <input name="name" defaultValue={role.name} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <input name="description" defaultValue={role.description ?? ""} className="input" />
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-1 text-sm font-semibold">Permissions</h2>
        <p className="mb-4 text-xs text-muted">
          Scope: <b>Own</b> = records they created · <b>White Label</b> = everything in their white label · <b>All</b> =
          platform-wide.
        </p>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="pb-2">Module</th>
              {ACTIONS.map((a) => (
                <th key={a} className="pb-2 capitalize">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((m) => (
              <tr key={m.key} className="border-t border-border">
                <td className="py-2.5 pr-4">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.description}</p>
                </td>
                {ACTIONS.map((a) => (
                  <td key={a} className="py-2.5 pr-3">
                    <select
                      name={`p_${m.key}_${a}`}
                      defaultValue={perms[m.key]?.[a] ?? "off"}
                      className="input w-auto py-1 text-xs"
                    >
                      {scopeOptions.map((s) => (
                        <option key={s} value={s}>
                          {SCOPE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SaveButton tip="Save role and permissions" />
    </form>
  );
}

export function DeleteRoleForm({ roleId }: { roleId: string }) {
  return (
    <form action={deleteRole}>
      <input type="hidden" name="id" value={roleId} />
      <ActionButton icon="trash" tip="Delete this role (only when no users have it)" label="Delete Role" variant="danger" />
    </form>
  );
}

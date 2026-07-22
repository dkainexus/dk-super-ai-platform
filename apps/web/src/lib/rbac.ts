// RBAC core: permission = module x action x scope.
//
//   action: view | add | edit | delete
//   scope:  own      -> only records the user created
//           merchant -> all records of the user's merchant
//           all      -> everything (platform side)
//
// Superadmins bypass every check. Merchant users are hard-capped at
// 'merchant' scope regardless of what their role says.

export type Action = "view" | "add" | "edit" | "delete";
export type Scope = "own" | "merchant" | "all";
export const ACTIONS: Action[] = ["view", "add", "edit", "delete"];
export const SCOPES: Scope[] = ["own", "merchant", "all"];

const SCOPE_RANK: Record<Scope, number> = { own: 0, merchant: 1, all: 2 };

/** perms[module][action] = scope */
export type PermissionMap = Record<string, Partial<Record<Action, Scope>>>;

export function buildPermissionMap(
  rows: { module: string; action: string; scope: string }[]
): PermissionMap {
  const map: PermissionMap = {};
  for (const r of rows) {
    (map[r.module] ??= {})[r.action as Action] = r.scope as Scope;
  }
  return map;
}

/** Effective scope for a module action, or null when not permitted. */
export function permittedScope(
  opts: { isSuperadmin: boolean; merchantId: string | null; perms: PermissionMap },
  module: string,
  action: Action
): Scope | null {
  if (opts.isSuperadmin) return "all";
  const scope = opts.perms[module]?.[action] ?? null;
  if (!scope) return null;
  // Merchant-side users can never exceed their own merchant.
  if (opts.merchantId && SCOPE_RANK[scope] > SCOPE_RANK.merchant) return "merchant";
  return scope;
}

import "server-only";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { readSession } from "./session";
import { buildPermissionMap, permittedScope, type Action, type Scope, type PermissionMap } from "./rbac";
import type { Merchant, Role, Staff, User } from "./types";

export type CurrentUser = {
  user: User;
  role: Role | null;
  merchant: Merchant | null; // null = platform side
  perms: PermissionMap;
  isSuper: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const { data } = await db()
    .from("users")
    .select("*, role:roles(*), merchant:merchants(*)")
    .eq("id", session.uid)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const { role, merchant, ...user } = data as User & { role: Role | null; merchant: Merchant | null };
  if (user.merchant_id && merchant?.status !== "active") return null;

  let perms: PermissionMap = {};
  if (role && !user.is_superadmin) {
    const { data: rows } = await db()
      .from("role_permissions")
      .select("module, action, scope")
      .eq("role_id", role.id);
    perms = buildPermissionMap(rows ?? []);
  }

  return { user, role, merchant, perms, isSuper: user.is_superadmin };
}

export function homePath(cu: CurrentUser): string {
  return cu.merchant ? "/m" : "/admin";
}

/** Effective scope for a module action, or null when not allowed. */
export function can(cu: CurrentUser, module: string, action: Action): Scope | null {
  return permittedScope(
    { isSuperadmin: cu.isSuper, merchantId: cu.user.merchant_id, perms: cu.perms },
    module,
    action
  );
}

/** Any signed-in user (handles forced password change). */
export async function requireUser(opts?: { allowPasswordChange?: boolean }): Promise<CurrentUser> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  if (cu.user.must_change_password && !opts?.allowPasswordChange) redirect("/change-password");
  return cu;
}

/** Platform-side pages under /admin. */
export async function requirePlatformUser(): Promise<CurrentUser> {
  const cu = await requireUser();
  if (cu.merchant) redirect("/m");
  return cu;
}

/** Merchant portal pages under /m. */
export async function requireMerchantUser(): Promise<CurrentUser & { merchant: Merchant }> {
  const cu = await requireUser();
  if (!cu.merchant) redirect("/admin");
  return cu as CurrentUser & { merchant: Merchant };
}

/** Guard a page/action: needs the permission, else bounced to their home. */
export async function requirePerm(module: string, action: Action): Promise<{ cu: CurrentUser; scope: Scope }> {
  const cu = await requireUser();
  const scope = can(cu, module, action);
  if (!scope) redirect(homePath(cu));
  return { cu, scope };
}

// ---------- Legacy bot-review pages (read the old `staff` table) ----------

export async function requireBotStaff(): Promise<Staff> {
  const cu = await requireUser();
  if (cu.merchant) redirect("/m");
  const { data } = await db().from("staff").select("*").eq("id", cu.user.id).maybeSingle();
  // Platform users that never existed in `staff` still get read access.
  return (data as Staff) ?? ({ id: cu.user.id, role: "admin" } as Staff);
}

export function canReview(staff: Staff): boolean {
  return ["ceo", "coo", "admin"].includes(staff.role);
}

"use server";

// Roles & users management. Shared by the platform side and the merchant
// portal; every entry is permission-guarded and merchant-capped.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm, requireUser, can } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { ACTIONS, type Action, type Scope } from "@/lib/rbac";
import { MODULES } from "@/modules/registry";
import type { Role } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function basePath(isMerchant: boolean, kind: "roles" | "users"): string {
  if (kind === "roles") return isMerchant ? "/m/roles" : "/admin/roles";
  return isMerchant ? "/m/team" : "/admin/users";
}

// ---------- Roles ----------

export async function createRole(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("roles", "add");
  const isMerchant = Boolean(cu.merchant);
  const back = basePath(isMerchant, "roles");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  // Platform users choose the level; merchant-created roles are always merchant-level.
  const level = isMerchant ? "merchant" : String(formData.get("level") ?? "platform");
  if (!name) fail(back, "Please enter a role name");
  if (level !== "platform" && level !== "merchant") fail(back, "Invalid role level");

  const { data, error } = await db()
    .from("roles")
    .insert({ level, name, description, merchant_id: cu.merchant?.id ?? null })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to create: ${error?.message}`);
  revalidatePath(back);
  redirect(`${back}/${data.id}`);
}

async function getEditableRole(roleId: string, back: string): Promise<{ role: Role; isMerchant: boolean }> {
  const cu = await requireUser();
  const { data } = await db().from("roles").select("*").eq("id", roleId).maybeSingle();
  const role = data as Role | null;
  if (!role) fail(back, "Role not found");
  if (role.is_system) fail(back, "System roles cannot be modified");
  if (cu.merchant && role.merchant_id !== cu.merchant.id) fail(back, "Not your role");
  return { role, isMerchant: Boolean(cu.merchant) };
}

/** Saves the whole permission matrix: fields p_<module>_<action> = off|own|merchant|all */
export async function saveRolePermissions(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("roles", "edit");
  const isMerchant = Boolean(cu.merchant);
  const roleId = String(formData.get("role_id") ?? "");
  const listPath = basePath(isMerchant, "roles");
  const back = `${listPath}/${roleId}`;
  const { role } = await getEditableRole(roleId, listPath);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (name) await db().from("roles").update({ name, description }).eq("id", role.id);

  const rows: { role_id: string; module: string; action: Action; scope: Scope }[] = [];
  for (const m of MODULES) {
    for (const a of ACTIONS) {
      let v = String(formData.get(`p_${m.key}_${a}`) ?? "off");
      if (v === "off") continue;
      // Merchant-created roles can never grant beyond merchant scope.
      if ((isMerchant || role.level === "merchant") && v === "all") v = "merchant";
      if (v !== "own" && v !== "merchant" && v !== "all") continue;
      rows.push({ role_id: role.id, module: m.key, action: a, scope: v as Scope });
    }
  }

  await db().from("role_permissions").delete().eq("role_id", role.id);
  if (rows.length) {
    const { error } = await db().from("role_permissions").insert(rows);
    if (error) fail(back, `Failed to save permissions: ${error.message}`);
  }
  revalidatePath(back);
  revalidatePath(listPath);
}

export async function deleteRole(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("roles", "delete");
  const isMerchant = Boolean(cu.merchant);
  const listPath = basePath(isMerchant, "roles");
  const roleId = String(formData.get("id") ?? "");
  const { role } = await getEditableRole(roleId, listPath);

  const { count } = await db().from("users").select("id", { count: "exact", head: true }).eq("role_id", role.id);
  if ((count ?? 0) > 0) fail(listPath, `Cannot delete: ${count} user(s) still have this role`);

  await db().from("roles").delete().eq("id", role.id);
  revalidatePath(listPath);
  redirect(listPath);
}

// ---------- Users ----------

/** Roles the current user may assign. */
async function assignableRoles(cuMerchantId: string | null): Promise<Role[]> {
  let q = db().from("roles").select("*").order("level").order("name");
  if (cuMerchantId) {
    q = q.eq("level", "merchant").or(`merchant_id.eq.${cuMerchantId},merchant_id.is.null`);
  }
  const { data } = await q;
  return (data ?? []) as Role[];
}

export async function createUser(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("users", "add");
  const isMerchant = Boolean(cu.merchant);
  const back = basePath(isMerchant, "users");

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const roleId = String(formData.get("role_id") ?? "");
  // Merchant users can only create users inside their merchant.
  const merchantId = isMerchant ? cu.merchant!.id : String(formData.get("merchant_id") ?? "") || null;

  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "Username must be 3-30 characters (letters, numbers, . _ -)");
  if (password.length < 6) fail(back, "Initial password must be at least 6 characters");

  const roles = await assignableRoles(cu.merchant?.id ?? null);
  const role = roles.find((r) => r.id === roleId);
  if (!role) fail(back, "Please choose a valid role");
  if (merchantId && role.level !== "merchant") fail(back, "Merchant users need a merchant-level role");
  if (!merchantId && role.level !== "platform") fail(back, "Platform users need a platform-level role");

  const { data: clash } = await db().from("users").select("id").ilike("username", username).maybeSingle();
  if (clash) fail(back, "This username is already taken");

  const { error } = await db().from("users").insert({
    username,
    password_hash: await hashPassword(password),
    name,
    merchant_id: merchantId,
    role_id: role.id,
  });
  if (error) fail(back, `Failed to create: ${error.message}`);
  revalidatePath(back);
}

async function getManagedUser(userId: string, back: string) {
  const cu = await requireUser();
  const { data } = await db().from("users").select("*").eq("id", userId).maybeSingle();
  if (!data) fail(back, "User not found");
  const target = data as { id: string; merchant_id: string | null; is_superadmin: boolean };
  if (target.is_superadmin && !cu.isSuper) fail(back, "Only a superadmin can manage superadmins");
  if (cu.merchant && target.merchant_id !== cu.merchant.id) fail(back, "Not your user");
  if (target.id === cu.user.id) fail(back, "Use My Profile to change your own account");
  return target;
}

export async function toggleUser(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("users", "edit");
  const back = basePath(Boolean(cu.merchant), "users");
  const target = await getManagedUser(String(formData.get("id") ?? ""), back);
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("users").update({ active }).eq("id", target.id);
  revalidatePath(back);
}

export async function resetUserPassword(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("users", "edit");
  const back = basePath(Boolean(cu.merchant), "users");
  const target = await getManagedUser(String(formData.get("id") ?? ""), back);
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) fail(back, "New password must be at least 6 characters");
  await db()
    .from("users")
    .update({ password_hash: await hashPassword(password), must_change_password: true })
    .eq("id", target.id);
  revalidatePath(back);
}

export async function setUserRole(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("users", "edit");
  const back = basePath(Boolean(cu.merchant), "users");
  const target = await getManagedUser(String(formData.get("id") ?? ""), back);
  const roleId = String(formData.get("role_id") ?? "");
  const roles = await assignableRoles(cu.merchant?.id ?? null);
  const role = roles.find((r) => r.id === roleId);
  if (!role) fail(back, "Invalid role");
  if (target.merchant_id && role.level !== "merchant") fail(back, "Merchant users need a merchant-level role");
  if (!target.merchant_id && role.level !== "platform") fail(back, "Platform users need a platform-level role");
  await db().from("users").update({ role_id: role.id }).eq("id", target.id);
  revalidatePath(back);
}

export async function deleteUser(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("users", "delete");
  const back = basePath(Boolean(cu.merchant), "users");
  const target = await getManagedUser(String(formData.get("id") ?? ""), back);
  await db().from("users").delete().eq("id", target.id);
  revalidatePath(back);
}

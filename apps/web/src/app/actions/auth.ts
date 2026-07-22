"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { getCurrentUser, homePath } from "@/lib/auth";
import { uploadFile, fileExt, ASSETS_BUCKET } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import type { Merchant, User } from "@/lib/types";

export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Please enter username and password" };
  console.log(`[auth] login attempt: ${username}`);

  const { data } = await db()
    .from("users")
    .select("*, merchant:merchants(*)")
    .ilike("username", username)
    .maybeSingle();
  const u = data as (User & { merchant: Merchant | null }) | null;
  if (!u) return { error: "Invalid username or password" };
  if (!u.active) return { error: "This account has been deactivated" };
  if (u.merchant_id && u.merchant?.status !== "active") {
    return { error: "This merchant has been suspended — contact the administrator" };
  }

  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) return { error: "Invalid username or password" };

  await createSession(u.id, u.merchant_id ? "merchant" : "staff");
  redirect(u.must_change_password ? "/change-password" : u.merchant_id ? "/m" : "/admin");
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");

  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "New password must be at least 6 characters" };
  if (next !== confirm) return { error: "The two passwords do not match" };

  // Forced first-login change skips the current-password check (they just
  // proved it at login); voluntary changes still require it.
  if (!cu.user.must_change_password) {
    const current = String(formData.get("current") ?? "");
    const ok = await verifyPassword(current, cu.user.password_hash);
    if (!ok) return { error: "Current password is incorrect" };
  }

  const { error } = await db()
    .from("users")
    .update({ password_hash: await hashPassword(next), must_change_password: false })
    .eq("id", cu.user.id);
  if (error) return { error: `Failed to save: ${error.message}` };

  console.log(`[auth] change-password ${cu.user.username}: OK`);
  redirect(homePath(cu));
}

// ---------- Profile ----------

export type ProfileState = { error?: string; ok?: boolean };

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
    return { error: "Username must be 3-30 characters (letters, numbers, . _ -)" };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Invalid email address" };
  }

  if (username !== cu.user.username) {
    const { data: clash } = await db().from("users").select("id").ilike("username", username).neq("id", cu.user.id).maybeSingle();
    if (clash) return { error: "This username is already taken" };
  }

  const patch: Record<string, unknown> = { username, email, name, updated_at: new Date().toISOString() };

  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 2 * 1024 * 1024) return { error: "Avatar must be under 2MB" };
    patch.avatar_path = await uploadFile(ASSETS_BUCKET, `avatars/${cu.user.id}.${fileExt(avatar)}`, avatar);
  }

  const { error } = await db().from("users").update(patch).eq("id", cu.user.id);
  if (error) return { error: `Failed to save: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

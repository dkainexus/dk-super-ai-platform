"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { getSessionUser, homePath } from "@/lib/auth";
import type { Merchant, MerchantUser, Staff } from "@/lib/types";

export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "请输入用户名和密码" };

  // Staff (superadmin CMS + bot review) first, then merchant accounts.
  const { data: staffRow } = await db()
    .from("staff")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  const staff = staffRow as Staff | null;
  if (staff) {
    if (!staff.active) return { error: "账号已停用" };
    const ok = staff.password_hash && (await verifyPassword(password, staff.password_hash));
    if (!ok) return { error: "用户名或密码错误" };
    await createSession(staff.id, "staff");
    redirect(staff.must_change_password ? "/change-password" : "/admin");
  }

  const { data: muRow } = await db()
    .from("merchant_users")
    .select("*, merchant:merchants(*)")
    .ilike("username", username)
    .maybeSingle();
  const mu = muRow as (MerchantUser & { merchant: Merchant }) | null;
  if (!mu) return { error: "用户名或密码错误" };
  if (!mu.active) return { error: "账号已停用" };
  if (!mu.merchant || mu.merchant.status !== "active") return { error: "商家已被停用，请联系管理员" };

  const ok = await verifyPassword(password, mu.password_hash);
  if (!ok) return { error: "用户名或密码错误" };

  await createSession(mu.id, "merchant");
  redirect(mu.must_change_password ? "/change-password" : "/m");
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const su = await getSessionUser();
  if (!su) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "新密码至少 6 位" };
  if (next !== confirm) return { error: "两次输入的新密码不一致" };

  const hash = su.kind === "staff" ? su.staff.password_hash : su.user.password_hash;
  const ok = hash && (await verifyPassword(current, hash));
  if (!ok) return { error: "当前密码不正确" };

  const table = su.kind === "staff" ? "staff" : "merchant_users";
  const id = su.kind === "staff" ? su.staff.id : su.user.id;
  await db()
    .from(table)
    .update({ password_hash: await hashPassword(next), must_change_password: false })
    .eq("id", id);

  redirect(homePath(su));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

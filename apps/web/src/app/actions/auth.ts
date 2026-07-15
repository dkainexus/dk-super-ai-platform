"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import type { Staff } from "@/lib/types";

export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "请输入用户名和密码" };

  const { data } = await db().from("staff").select("*").ilike("username", username).maybeSingle();
  const staff = data as Staff | null;
  if (!staff) return { error: "用户名或密码错误" };
  if (!staff.active) return { error: "账号已停用" };

  const ok = staff.password_hash && (await verifyPassword(password, staff.password_hash));
  if (!ok) return { error: "用户名或密码错误" };

  await createSession(staff.id);
  redirect(staff.must_change_password ? "/change-password" : "/dashboard");
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "新密码至少 6 位" };
  if (next !== confirm) return { error: "两次输入的新密码不一致" };

  const ok = user.password_hash && (await verifyPassword(current, user.password_hash));
  if (!ok) return { error: "当前密码不正确" };

  await db()
    .from("staff")
    .update({ password_hash: await hashPassword(next), must_change_password: false })
    .eq("id", user.id);

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

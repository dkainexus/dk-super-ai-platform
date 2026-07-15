import "server-only";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { readSession } from "./session";
import { REVIEWER_ROLES, type Staff } from "./types";

export async function getCurrentUser(): Promise<Staff | null> {
  const uid = await readSession();
  if (!uid) return null;
  const { data } = await db()
    .from("staff")
    .select("*")
    .eq("id", uid)
    .eq("active", true)
    .maybeSingle();
  return (data as Staff) ?? null;
}

export async function requireUser(opts?: { allowPasswordChange?: boolean }): Promise<Staff> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password && !opts?.allowPasswordChange) {
    redirect("/change-password");
  }
  return user;
}

export function canReview(user: Staff): boolean {
  return REVIEWER_ROLES.includes(user.role);
}

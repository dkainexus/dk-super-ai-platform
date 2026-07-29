export const DEFAULT_APP_PASSWORD = "123456";

import "server-only";
import { db } from "@/lib/supabase";
import type { Occupation } from "@/lib/types";

/** Global active occupations list (shared by all countries). */
export async function occupationsList(): Promise<Occupation[]> {
  const { data } = await db()
    .from("occupations")
    .select("*")
    .eq("active", true)
    .order("sort")
    .order("name");
  return (data ?? []) as Occupation[];
}

/**
 * Give an owner their mobile-app sign-in. Called right after an owner is
 * created, so every owner can use the app immediately: the username comes from
 * the reference number and the password is the shared starter one, which the
 * app forces them to change on first sign-in.
 */
export async function ensureAppAccess(ownerId: string): Promise<void> {
  const { data: owner } = await db()
    .from("owners")
    .select("id, ref, full_name, app_username, app_password_hash")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner || (owner.app_username && owner.app_password_hash)) return;

  const base =
    (owner.ref ?? owner.full_name ?? "owner").toLowerCase().replace(/[^a-z0-9]+/g, "") || "owner";
  let username = (owner.app_username as string | null) ?? base;
  if (!owner.app_username) {
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}${n}`;
      const { data: taken } = await db()
        .from("owners")
        .select("id")
        .eq("app_username", candidate)
        .maybeSingle();
      if (!taken) {
        username = candidate;
        break;
      }
    }
  }

  const { hashPassword } = await import("@/lib/password");
  await db()
    .from("owners")
    .update({
      app_username: username,
      app_password_hash: await hashPassword(DEFAULT_APP_PASSWORD),
      app_must_change_password: true,
    })
    .eq("id", ownerId);
}

import "server-only";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { readSession } from "./session";
import {
  ADMIN_ROLES,
  REVIEWER_ROLES,
  type Merchant,
  type MerchantUser,
  type Staff,
} from "./types";

export type SessionUser =
  | { kind: "staff"; staff: Staff }
  | { kind: "merchant"; user: MerchantUser; merchant: Merchant };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;

  if (session.kind === "merchant") {
    const { data } = await db()
      .from("merchant_users")
      .select("*, merchant:merchants(*)")
      .eq("id", session.uid)
      .eq("active", true)
      .maybeSingle();
    if (!data) return null;
    const { merchant, ...user } = data as MerchantUser & { merchant: Merchant };
    if (!merchant || merchant.status !== "active") return null;
    return { kind: "merchant", user, merchant };
  }

  const { data } = await db()
    .from("staff")
    .select("*")
    .eq("id", session.uid)
    .eq("active", true)
    .maybeSingle();
  return data ? { kind: "staff", staff: data as Staff } : null;
}

export function homePath(su: SessionUser): string {
  return su.kind === "merchant" ? "/m" : "/admin";
}

/** Staff-only pages (bot review queue, jobs, admin CMS). */
export async function requireUser(opts?: { allowPasswordChange?: boolean }): Promise<Staff> {
  const su = await getSessionUser();
  if (!su) redirect("/login");
  if (su.kind !== "staff") redirect("/m");
  if (su.staff.must_change_password && !opts?.allowPasswordChange) {
    redirect("/change-password");
  }
  return su.staff;
}

/** Superadmin CMS pages: countries / merchants / fields / owner review. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireUser();
  if (!ADMIN_ROLES.includes(staff.role)) redirect("/dashboard");
  return staff;
}

/** Merchant portal pages. */
export async function requireMerchant(opts?: {
  allowPasswordChange?: boolean;
}): Promise<{ user: MerchantUser; merchant: Merchant }> {
  const su = await getSessionUser();
  if (!su) redirect("/login");
  if (su.kind !== "merchant") redirect("/admin");
  if (su.user.must_change_password && !opts?.allowPasswordChange) {
    redirect("/change-password");
  }
  return { user: su.user, merchant: su.merchant };
}

export function canReview(user: Staff): boolean {
  return REVIEWER_ROLES.includes(user.role);
}

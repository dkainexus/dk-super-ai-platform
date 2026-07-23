"use server";

// Notifications module actions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { activeCountry } from "@/modules/merchants/lib";
import { notifyOwners } from "./lib";
import type { NotificationType } from "@/lib/types";

const TYPES: NotificationType[] = ["general", "company", "reward", "training", "exam"];

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

export async function sendNotification(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("notifications", "add");
  const back = cu.merchant ? "/m/notifications" : "/admin/notifications";

  const typeRaw = String(formData.get("type") ?? "general");
  const type = (TYPES.includes(typeRaw as NotificationType) ? typeRaw : "general") as NotificationType;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const target = String(formData.get("owner_id") ?? ""); // "" = all matching owners
  if (!title) fail(back, "Please enter a title");

  let ownerIds: string[] = [];
  if (target) {
    let q = db().from("owners").select("id").eq("id", target);
    if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
    const { data } = await q;
    ownerIds = ((data ?? []) as { id: string }[]).map((o) => o.id);
    if (ownerIds.length === 0) fail(back, "Owner not found");
  } else {
    let q = db().from("owners").select("id").neq("status", "banned");
    if (cu.merchant) {
      q = q.eq("merchant_id", cu.merchant.id);
      const { active } = await activeCountry(cu);
      if (active) q = q.eq("country_id", active.id);
    } else {
      const merchantId = String(formData.get("merchant_id") ?? "");
      const countryId = String(formData.get("country_id") ?? "");
      if (merchantId) q = q.eq("merchant_id", merchantId);
      if (countryId) q = q.eq("country_id", countryId);
    }
    const { data } = await q;
    ownerIds = ((data ?? []) as { id: string }[]).map((o) => o.id);
    if (ownerIds.length === 0) fail(back, "No owners match this audience");
  }

  const sent = await notifyOwners(ownerIds, type, title, body, cu.user.id);
  revalidatePath(back);
  redirect(`${back}?sent=${sent}`);
}

export async function deleteNotification(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("notifications", "delete");
  const id = String(formData.get("id") ?? "");
  const back = cu.merchant ? "/m/notifications" : "/admin/notifications";

  if (cu.merchant) {
    const { data } = await db()
      .from("notifications")
      .select("id, owner:owners!inner(merchant_id)")
      .eq("id", id)
      .maybeSingle();
    const owner = (data as { owner?: { merchant_id: string } } | null)?.owner;
    if (!owner || owner.merchant_id !== cu.merchant.id) fail(back, "Not found");
  }
  await db().from("notifications").delete().eq("id", id);
  revalidatePath(back);
  redirect(back);
}

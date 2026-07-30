"use server";

// Shipping module actions: the courier trail, kept by the people who ship.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** The parcel left: courier and tracking number onto the record. */
export async function markShipped(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("shipping", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/shipping");
  const courier = String(formData.get("courier") ?? "").trim();
  const trackingNo = String(formData.get("tracking_no") ?? "").trim();
  if (!courier || !trackingNo) fail(back, "Enter the courier and the tracking number");

  const { data } = await db()
    .from("shipments")
    .update({ courier, tracking_no: trackingNo, shipped_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", id)
    .is("shipped_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (!data || data.length === 0) fail(back, "This shipment is already shipped or cancelled");
  revalidatePath(back);
  redirect(`${back}?saved=shipped`);
}

/** Fix a wrong courier or tracking number on an in-transit shipment. */
export async function updateTracking(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("shipping", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/shipping");
  const courier = String(formData.get("courier") ?? "").trim();
  const trackingNo = String(formData.get("tracking_no") ?? "").trim();
  if (!courier || !trackingNo) fail(back, "Enter the courier and the tracking number");
  await db()
    .from("shipments")
    .update({ courier, tracking_no: trackingNo, updated_by: cu.user.id })
    .eq("id", id)
    .not("shipped_at", "is", null)
    .is("cancelled_at", null);
  revalidatePath(back);
  redirect(back);
}

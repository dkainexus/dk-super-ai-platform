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

async function courierOf(formData: FormData, back: string): Promise<{ id: string; name: string }> {
  const courierId = String(formData.get("courier_id") ?? "");
  if (!courierId) fail(back, "Pick the courier");
  const { data } = await db().from("couriers").select("id, name").eq("id", courierId).maybeSingle();
  if (!data) fail(back, "Courier not found");
  return data as { id: string; name: string };
}

/** The parcel left: courier and tracking number onto the record. */
export async function markShipped(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("shipping", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/shipping");
  const trackingNo = String(formData.get("tracking_no") ?? "").trim();
  if (!trackingNo) fail(back, "Enter the tracking number");
  const courier = await courierOf(formData, back);

  const { data } = await db()
    .from("shipments")
    .update({
      courier: courier.name,
      courier_id: courier.id,
      tracking_no: trackingNo,
      shipped_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
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
  const trackingNo = String(formData.get("tracking_no") ?? "").trim();
  if (!trackingNo) fail(back, "Enter the tracking number");
  const courier = await courierOf(formData, back);
  await db()
    .from("shipments")
    .update({ courier: courier.name, courier_id: courier.id, tracking_no: trackingNo, updated_by: cu.user.id })
    .eq("id", id)
    .not("shipped_at", "is", null)
    .is("cancelled_at", null);
  revalidatePath(back);
  redirect(back);
}


/** Add or edit a courier — name plus the tracking page with {tracking} in it. */
export async function saveCourier(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("shipping", "edit");
  void cu;
  const back = "/admin/shipping/couriers";
  const id = String(formData.get("id") ?? "") || null;
  const countryId = String(formData.get("country_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const urlTemplate = String(formData.get("url_template") ?? "").trim() || null;
  if (!countryId || !name) fail(back, "Enter the courier's name");
  if (!urlTemplate) fail(back, "Every courier needs its tracking link — that's what makes the numbers clickable");
  if (!urlTemplate.includes("{tracking}"))
    fail(back, "The tracking link must contain {tracking} where the number goes");

  const row = { country_id: countryId, name, url_template: urlTemplate };
  const { error } = id
    ? await db().from("couriers").update(row).eq("id", id)
    : await db().from("couriers").insert(row);
  if (error)
    fail(back, /duplicate|unique/i.test(error.message) ? "That courier already exists" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function toggleCourier(formData: FormData): Promise<void> {
  await requirePerm("shipping", "edit");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("couriers").update({ active }).eq("id", id);
  revalidatePath("/admin/shipping/couriers");
  redirect("/admin/shipping/couriers");
}

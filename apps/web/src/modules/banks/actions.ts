"use server";

// Banks module actions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { ASSETS_BUCKET, fileExt, uploadFile } from "@/lib/storage";

/** "App PIN" → "app_pin" — stable keys for per-bank extra account fields. */
function slugKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}


function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Banks module ----------

export async function createBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "add");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
  if (!countryId) fail("/admin/banks", "Please choose a country");
  if (!name) fail(back, "Please enter the bank name");

  const { count } = await db().from("banks").select("id", { count: "exact", head: true }).eq("country_id", countryId);
  const { error } = await db().from("banks").insert({
    country_id: countryId,
    name,
    code,
    sort: ((count ?? 0) + 1) * 10,
  });
  if (error) fail(back, error.message.includes("duplicate") ? "This bank already exists in this country" : `Failed to create: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

export async function updateBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
  const active = formData.get("active") === "on";
  if (!name) fail(back, "Bank name cannot be empty");

  // Payment channels are ticked from the country's list; extra fields and the
  // logo have their own instant actions.
  const channels = formData.getAll("channels").map(String).filter(Boolean);
  const patch: Record<string, unknown> = { name, code, active, channels };

  const { error } = await db().from("banks").update(patch).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

export async function deleteBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "delete");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  await db().from("banks").delete().eq("id", id);
  revalidatePath("/admin/banks");
  redirect(countryId ? `/admin/banks?country=${countryId}` : "/admin/banks");
}



/** Add one extra account field to a bank (chip UI). */
export async function addBankField(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const label = String(formData.get("label") ?? "").trim();
  if (!label) fail(back, "Please enter the field name");

  const { data: bank } = await db().from("banks").select("account_fields").eq("id", id).maybeSingle();
  const list = (bank?.account_fields ?? []) as { key: string; label: string }[];
  const key = slugKey(label);
  if (list.some((f) => f.key === key)) fail(back, "This field already exists on this bank");
  const { error } = await db().from("banks").update({ account_fields: [...list, { key, label }] }).eq("id", id);
  if (error) fail(back, `Failed to add: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

export async function removeBankField(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const key = String(formData.get("key") ?? "");
  const { data: bank } = await db().from("banks").select("account_fields").eq("id", id).maybeSingle();
  const list = ((bank?.account_fields ?? []) as { key: string; label: string }[]).filter((f) => f.key !== key);
  const { error } = await db().from("banks").update({ account_fields: list }).eq("id", id);
  if (error) fail(back, `Failed to remove: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

/** Remove a bank's logo. */
export async function removeBankLogo(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const { data: bank } = await db().from("banks").select("logo_path").eq("id", id).maybeSingle();
  if (bank?.logo_path) await db().storage.from(ASSETS_BUCKET).remove([bank.logo_path]);
  await db().from("banks").update({ logo_path: null }).eq("id", id);
  revalidatePath("/admin/banks");
  redirect(`/admin/banks?country=${countryId}`);
}

/** Upload/replace a bank's logo on its own (fires as soon as a file is picked). */
export async function uploadBankLogo(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) fail(back, "Please choose an image");
  if (!logo.type.startsWith("image/")) fail(back, "The logo must be an image");
  try {
    const path = await uploadFile(ASSETS_BUCKET, `bank-logos/${id}.${fileExt(logo)}`, logo);
    await db().from("banks").update({ logo_path: path }).eq("id", id);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Logo upload failed");
  }
  revalidatePath("/admin/banks");
  redirect(back);
}

/** Persist a drag-and-drop ordering of a country's banks. */
export async function reorderBanks(countryId: string, ids: string[]): Promise<void> {
  await requirePerm("banks", "edit");
  await Promise.all(
    ids.map((id, i) => db().from("banks").update({ sort: (i + 1) * 10 }).eq("id", id).eq("country_id", countryId))
  );
  revalidatePath("/admin/banks");
}

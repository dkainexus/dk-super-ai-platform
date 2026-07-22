"use server";

// Merchants module actions (core) — displayed as "White Label" in the UI.
// The database keeps the merchants naming; only labels changed.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/slug";
import { uploadFile, fileExt, ASSETS_BUCKET } from "@/lib/storage";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Merchants ----------

export async function createMerchant(formData: FormData): Promise<void> {
  await requirePerm("merchants", "add");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) fail(back, "Please enter a white label name");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "Login username must be 3-30 characters");
  if (password.length < 6) fail(back, "Initial password must be at least 6 characters");

  const { data: clash } = await db().from("users").select("id").ilike("username", username).maybeSingle();
  if (clash) fail(back, "This username is already taken");

  const { data: merchant, error } = await db()
    .from("merchants")
    .insert({ name, subdomain })
    .select("id")
    .single();
  if (error || !merchant) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);

  await db().from("merchant_countries").insert({ merchant_id: merchant.id, country_id: countryId });

  const { data: ownerRole } = await db()
    .from("roles")
    .select("id")
    .eq("name", "White Label Owner")
    .eq("is_system", true)
    .single();
  const { error: uerr } = await db().from("users").insert({
    merchant_id: merchant.id,
    username,
    password_hash: await hashPassword(password),
    name,
    role_id: ownerRole?.id ?? null,
  });
  if (uerr) {
    await db().from("merchants").delete().eq("id", merchant.id);
    fail(back, `Failed to create login account: ${uerr.message}`);
  }
  revalidatePath(back);
  redirect(`/admin/merchants/${merchant.id}`);
}

export async function updateMerchantByAdmin(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const status = String(formData.get("status") ?? "active");
  if (!name) fail(back, "Merchant name cannot be empty");

  const { error } = await db()
    .from("merchants")
    .update({ name, subdomain, status: status === "suspended" ? "suspended" : "active" })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
}

export async function createMerchantUser(formData: FormData): Promise<void> {
  await requirePerm("users", "add");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "Username must be 3-30 characters");
  if (password.length < 6) fail(back, "Initial password must be at least 6 characters");

  const { data: clash } = await db().from("users").select("id").ilike("username", username).maybeSingle();
  if (clash) fail(back, "This username is already taken");

  const { data: ownerRole } = await db()
    .from("roles")
    .select("id")
    .eq("name", "White Label Owner")
    .eq("is_system", true)
    .single();
  const { error } = await db().from("users").insert({
    merchant_id: merchantId,
    username,
    password_hash: await hashPassword(password),
    name,
    role_id: ownerRole?.id ?? null,
  });
  if (error) fail(back, `Failed to create: ${error.message}`);
  revalidatePath(back);
}

export async function resetMerchantUserPassword(formData: FormData): Promise<void> {
  await requirePerm("users", "edit");
  const id = String(formData.get("id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) fail(back, "New password must be at least 6 characters");

  await db()
    .from("users")
    .update({ password_hash: await hashPassword(password), must_change_password: true })
    .eq("id", id);
  revalidatePath(back);
}

export async function toggleMerchantUser(formData: FormData): Promise<void> {
  await requirePerm("users", "edit");
  const id = String(formData.get("id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("users").update({ active }).eq("id", id);
  revalidatePath(`/admin/merchants/${merchantId}`);
}

export async function uploadMerchantLogoByAdmin(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(back, "Please choose a logo file");
  if (file.size > 2 * 1024 * 1024) fail(back, "Logo must be under 2MB");

  const path = await uploadFile(ASSETS_BUCKET, `logos/${id}.${fileExt(file)}`, file);
  await db().from("merchants").update({ logo_path: path }).eq("id", id);
  revalidatePath(back);
}


/** Which countries a white label operates in (checkboxes mc_<countryId>). */
export async function saveMerchantCountries(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;

  const { data: countries } = await db().from("countries").select("id");
  const wanted = ((countries ?? []) as { id: string }[])
    .map((c) => c.id)
    .filter((id) => formData.get(`mc_${id}`) === "on");
  if (wanted.length === 0) fail(back, "A white label needs at least one country");

  const { data: current } = await db().from("merchant_countries").select("country_id").eq("merchant_id", merchantId);
  const currentIds = ((current ?? []) as { country_id: string }[]).map((r) => r.country_id);

  // Refuse to remove a country that still has owners or companies.
  for (const removed of currentIds.filter((id) => !wanted.includes(id))) {
    const { count: ownerCount } = await db()
      .from("owners")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("country_id", removed);
    const { count: companyCount } = await db()
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("country_id", removed);
    if ((ownerCount ?? 0) > 0 || (companyCount ?? 0) > 0) {
      fail(back, "Cannot remove a country that still has owners or companies");
    }
  }

  await db().from("merchant_countries").delete().eq("merchant_id", merchantId).not("country_id", "in", `(${wanted.join(",")})`);
  for (const id of wanted.filter((id) => !currentIds.includes(id))) {
    await db().from("merchant_countries").insert({ merchant_id: merchantId, country_id: id });
  }
  revalidatePath(back);
  redirect(back);
}

"use server";

// Platform CMS actions: countries / merchants / custom fields / owner review.
// Guarded by requirePerm(module, action); the service-role client bypasses RLS.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/slug";
import { uploadFile, fileExt, ASSETS_BUCKET } from "@/lib/storage";
import type { FieldType } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------- Countries ----------

export async function createCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "add");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const flag = String(formData.get("flag") ?? "").trim() || null;
  if (!/^[A-Z]{2}$/.test(code)) fail("/admin/countries", "Country code must be 2 letters, e.g. TH");
  if (!name) fail("/admin/countries", "Please enter a country name");

  const { error } = await db().from("countries").insert({ code, name, flag });
  if (error) fail("/admin/countries", `Failed to create: ${error.message}`);
  revalidatePath("/admin/countries");
}

export async function toggleCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("countries").update({ active }).eq("id", id);
  revalidatePath("/admin/countries");
}

// ---------- Custom fields ----------

export async function createCountryField(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const label = String(formData.get("label") ?? "").trim();
  const rawKey = String(formData.get("field_key") ?? "").trim();
  const fieldType = String(formData.get("field_type") ?? "text") as FieldType;
  const required = formData.get("required") === "on";
  const optionsRaw = String(formData.get("options") ?? "").trim();

  if (!label) fail(back, "Please enter a field label");
  if (!["text", "number", "date", "file", "select"].includes(fieldType)) fail(back, "Invalid field type");

  let fieldKey = slugify(rawKey || label);
  if (!fieldKey) fieldKey = `field_${Date.now().toString(36)}`;

  const options =
    fieldType === "select"
      ? optionsRaw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)
      : [];
  if (fieldType === "select" && options.length === 0) fail(back, "Select fields need at least one option");

  const { count } = await db()
    .from("country_fields")
    .select("id", { count: "exact", head: true })
    .eq("country_id", countryId);

  const { error } = await db().from("country_fields").insert({
    country_id: countryId,
    field_key: fieldKey,
    label,
    field_type: fieldType,
    options,
    required,
    sort: ((count ?? 0) + 1) * 10,
  });
  if (error) fail(back, `Failed to create: ${error.message}`);
  revalidatePath(back);
}

export async function updateCountryField(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const label = String(formData.get("label") ?? "").trim();
  const required = formData.get("required") === "on";
  const sort = parseInt(String(formData.get("sort") ?? "100"), 10) || 100;
  const active = formData.get("active") === "on";
  if (!label) fail(back, "Field label cannot be empty");

  await db().from("country_fields").update({ label, required, sort, active }).eq("id", id);
  revalidatePath(back);
}

export async function deleteCountryField(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;

  // Refuse to delete a field that already has values; deactivate instead.
  const { count } = await db()
    .from("owner_field_values")
    .select("id", { count: "exact", head: true })
    .eq("field_id", id);
  if ((count ?? 0) > 0) {
    await db().from("country_fields").update({ active: false }).eq("id", id);
  } else {
    await db().from("country_fields").delete().eq("id", id);
  }
  revalidatePath(back);
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

  if (!name) fail(back, "Please enter a merchant name");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "Login username must be 3-30 characters");
  if (password.length < 6) fail(back, "Initial password must be at least 6 characters");

  const { data: clash } = await db().from("users").select("id").ilike("username", username).maybeSingle();
  if (clash) fail(back, "This username is already taken");

  const { data: merchant, error } = await db()
    .from("merchants")
    .insert({ country_id: countryId, name, subdomain })
    .select("id")
    .single();
  if (error || !merchant) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);

  const { data: ownerRole } = await db()
    .from("roles")
    .select("id")
    .eq("name", "Merchant Owner")
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
    .eq("name", "Merchant Owner")
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

// ---------- Owner review ----------

export async function reviewOwner(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/owners/${id}`;
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (decision !== "approved" && decision !== "rejected") fail(back, "Invalid operation");
  if (decision === "rejected" && !reason) fail(back, "Please provide a rejection reason");

  const { data: owner } = await db()
    .from("owners")
    .update({
      status: decision,
      reject_reason: decision === "rejected" ? reason : null,
      reviewed_by: cu.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("telegram_user_id")
    .single();

  // Owners collected over Telegram get the review result pushed by the bot.
  if (owner?.telegram_user_id) {
    await db().from("bot_jobs").insert({
      job_type: "onboarding.notify_cms_owner_review",
      target_bot: "onboarding",
      scope: { owner_id: id },
      payload: { telegram_user_id: owner.telegram_user_id, decision, reason },
      requested_by: { source: "web", staff_id: cu.user.id },
    });
  }
  revalidatePath("/admin/owners");
  revalidatePath(back);
}

"use server";

// Owners module actions (platform side): custom fields, review, create/edit, occupations.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { DEFAULT_APP_PASSWORD } from "./lib";
import { slugify } from "@/lib/slug";
import { uploadFile, fileExt } from "@/lib/storage";
import { merchantHasCountry } from "@/modules/merchants/lib";
import type { FieldType } from "@/lib/types";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Custom fields ----------

export async function createCountryField(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const countryId = String(formData.get("country_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/settings/owners");
  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("field_type") ?? "text") as FieldType;
  const required = formData.get("required") === "on";
  const optionsRaw = String(formData.get("options") ?? "").trim();

  if (!label) fail(back, "Please enter a field label");
  if (!["text", "number", "date", "file", "select", "multiselect"].includes(fieldType)) fail(back, "Invalid field type");

  // The storage key is derived from the label — nobody should have to type it.
  let fieldKey = slugify(label);
  if (!fieldKey) fieldKey = `field_${Date.now().toString(36)}`;

  const choiceType = fieldType === "select" || fieldType === "multiselect";
  const options = choiceType
    ? optionsRaw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)
    : [];
  if (choiceType && options.length === 0) fail(back, "Dropdown and multiple select need at least one choice");

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
  revalidatePath("/admin/settings/owners");
  redirect(back);
}

export async function updateCountryField(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/settings/owners");
  const label = String(formData.get("label") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "").trim();
  const required = formData.get("required") === "on";
  const sort = parseInt(String(formData.get("sort") ?? "100"), 10) || 100;
  const active = formData.get("active") === "on";
  if (!label) fail(back, "Field label cannot be empty");

  const options = optionsRaw.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean);
  await db().from("country_fields").update({ label, required, sort, active, options }).eq("id", id);
  revalidatePath("/admin/settings/owners");
}

export async function deleteCountryField(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/settings/owners");

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
  revalidatePath("/admin/settings/owners");
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

// ---------- Platform-side owner create/edit ----------
// Platform staff (scope All) manage owners for any merchant without logging
// into the merchant portal. Mirrors the merchant-side saveOwner.

export async function adminSaveOwner(formData: FormData): Promise<void> {
  const existingId = String(formData.get("id") ?? "") || null;
  const { cu } = await requirePerm("owners", existingId ? "edit" : "add");

  let merchantId: string;
  let countryId: string;
  let owner: import("@/lib/types").Owner | null = null;

  if (existingId) {
    const { data } = await db().from("owners").select("*").eq("id", existingId).maybeSingle();
    if (!data) fail("/admin/owners", "Owner not found");
    owner = data as import("@/lib/types").Owner;
    merchantId = owner.merchant_id;
    countryId = owner.country_id;
  } else {
    merchantId = String(formData.get("merchant_id") ?? "");
    const { data: m } = await db().from("merchants").select("id").eq("id", merchantId).maybeSingle();
    if (!m) fail("/admin/owners/new", "Please choose a valid white label");
    countryId = String(formData.get("country_id") ?? "");
    if (!countryId || !(await merchantHasCountry(merchantId, countryId))) {
      fail(`/admin/owners/new?merchant=${merchantId}`, "Please choose one of this white label's countries");
    }
  }
  const back = existingId ? `/admin/owners/${existingId}/edit` : `/admin/owners/new?merchant=${merchantId}`;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const idNumber = String(formData.get("id_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const bankId = String(formData.get("bank_id") ?? "") || null;
  const bankAccountNo = String(formData.get("bank_account_no") ?? "").trim() || null;
  const occupationId = String(formData.get("occupation_id") ?? "") || null;
  const address = {
    address_no: String(formData.get("address_no") ?? "").trim() || null,
    street: String(formData.get("street") ?? "").trim() || null,
    subdistrict: String(formData.get("subdistrict") ?? "").trim() || null,
    district: String(formData.get("district") ?? "").trim() || null,
    province: String(formData.get("province") ?? "").trim() || null,
    postal_code: String(formData.get("postal_code") ?? "").trim() || null,
    agent_id: String(formData.get("agent_id") ?? "") || null,
  };

  const gender = String(formData.get("gender") ?? "") || null;
  const maritalStatus = String(formData.get("marital_status") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!fullName) fail(back, "Please enter the full name");

  if (owner) {
    await db()
      .from("owners")
      .update({
        full_name: fullName,
        id_number: idNumber || null,
        notes,
        bank_id: bankId,
        bank_account_no: bankAccountNo,
        occupation_id: occupationId,
        ...address,
        gender,
        marital_status: maritalStatus,
        phone,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.id);
  } else {
    const { data, error } = await db()
      .from("owners")
      .insert({
        merchant_id: merchantId,
        country_id: countryId,
        full_name: fullName,
        id_number: idNumber || null,
        notes,
        bank_id: bankId,
        bank_account_no: bankAccountNo,
        occupation_id: occupationId,
        ...address,
        gender,
        marital_status: maritalStatus,
        phone,
        email,
        created_by: cu.user.id,
      })
      .select("*")
      .single();
    if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);
    owner = data as import("@/lib/types").Owner;
  }

  // Built-in ID photos
  const patch: Record<string, string> = {};
  for (const [field, col] of [
    ["id_front", "id_front_path"],
    ["id_back", "id_back_path"],
    ["photo_full_body", "photo_full_body_path"],
  ] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) fail(back, "Photos must be under 8MB");
      patch[col] = await uploadFile("owner-docs", `owners/${owner.id}/${field}.${fileExt(file)}`, file);
    }
  }
  await db()
    .from("owners")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", owner.id);

  // Country custom fields
  const { data: fields } = await db()
    .from("country_fields")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort");
  for (const f of (fields ?? []) as import("@/lib/types").CountryField[]) {
    if (f.field_type === "file") {
      const file = formData.get(`cff_${f.id}`);
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) fail(back, `${f.label} file must be under 8MB`);
        const path = await uploadFile("owner-docs", `owners/${owner.id}/f_${f.field_key}.${fileExt(file)}`, file);
        await db()
          .from("owner_field_values")
          .upsert(
            { owner_id: owner.id, field_id: f.id, file_path: path, updated_at: new Date().toISOString() },
            { onConflict: "owner_id,field_id" }
          );
      }
    } else {
      // Multi-select posts one value per ticked box; everything else posts one.
      const picked = formData.getAll(`cf_${f.id}`).map(String);
      if (picked.length === 0) continue;
      const raw = f.field_type === "multiselect" ? picked.join(", ") : picked[0];
      await db()
        .from("owner_field_values")
        .upsert(
          {
            owner_id: owner.id,
            field_id: f.id,
            value_text: String(raw).trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_id,field_id" }
        );
    }
  }

  revalidatePath("/admin/owners");
  redirect(`/admin/owners/${owner.id}`);
}


// ---------- Occupations module ----------





/** Ban / unban an owner. Unban returns the owner to Approved. */
export async function setOwnerBanned(formData: FormData): Promise<void> {
  const { cu, scope } = await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const banned = String(formData.get("banned") ?? "") === "true";
  const base = cu.merchant ? "/m/owners" : "/admin/owners";

  const { data: owner } = await db().from("owners").select("id, merchant_id, created_by").eq("id", id).maybeSingle();
  if (!owner) redirect(base);
  if (scope === "merchant" && owner.merchant_id !== cu.user.merchant_id) redirect(base);
  if (scope === "own" && owner.created_by !== cu.user.id) redirect(base);

  await db()
    .from("owners")
    .update({ status: banned ? "banned" : "approved", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(base);
  redirect(`${base}/${id}`);
}

// ---------- Mobile app access ----------

/** Set (or clear) an owner's mobile-app login credentials. */
export async function setOwnerAppAccess(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/owners/${id}`);
  const clear = formData.get("clear") === "true";
  const username = String(formData.get("app_username") ?? "").trim().toLowerCase();
  const password = String(formData.get("app_password") ?? "");

  let q = db().from("owners").select("id, merchant_id, app_password_hash").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data: owner } = await q.maybeSingle();
  if (!owner) fail(back, "Owner not found");

  if (clear) {
    await db()
      .from("owners")
      .update({ app_username: null, app_password_hash: null })
      .eq("id", id);
    revalidatePath(back);
    redirect(back);
  }

  if (!/^[a-z0-9_.@-]{3,40}$/.test(username))
    fail(back, "Username: 3-40 chars, letters/numbers/._@- only");
  if (password && password.length < 6) fail(back, "Password must be at least 6 characters");
  if (!password && !owner.app_password_hash) fail(back, "Please set an initial password");

  const patch: Record<string, unknown> = { app_username: username };
  if (password) {
    const { hashPassword } = await import("@/lib/password");
    patch.app_password_hash = await hashPassword(password);
    patch.app_must_change_password = password === DEFAULT_APP_PASSWORD;
  }
  const { error } = await db().from("owners").update(patch).eq("id", id);
  if (error)
    fail(back, error.message.includes("owners_app_username") ? "This username is already taken" : `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=app`);
}

// ---------- Occupations & their categories ----------

export async function createOccupationCategory(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations/categories";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Please enter a category name");
  const { error } = await db().from("occupation_categories").insert({ name });
  if (error) fail(back, error.message.includes("duplicate") ? "That category already exists" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function updateOccupationCategory(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations/categories";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Category name cannot be empty");
  const { error } = await db().from("occupation_categories").update({ name }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function deleteOccupationCategory(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations/categories";
  const id = String(formData.get("id") ?? "");
  await db().from("occupation_categories").delete().eq("id", id);
  revalidatePath(back);
  revalidatePath("/admin/occupations");
  redirect(back);
}

export async function createOccupation(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Please enter the occupation");
  const { count } = await db().from("occupations").select("id", { count: "exact", head: true });
  const { error } = await db().from("occupations").insert({
    name,
    category_id: String(formData.get("category_id") ?? "") || null,
    sort: ((count ?? 0) + 1) * 10,
  });
  if (error) fail(back, error.message.includes("duplicate") ? "That occupation already exists" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function deleteOccupation(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations";
  const id = String(formData.get("id") ?? "");
  const { error } = await db().from("occupations").delete().eq("id", id);
  if (error) fail(back, "This occupation is in use by an owner");
  revalidatePath(back);
  redirect(back);
}

/** Rename an occupation or move it to another category (auto-saves). */
export async function setOccupation(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const back = "/admin/occupations";
  const id = String(formData.get("id") ?? "");
  const patch: Record<string, unknown> = {};
  const name = String(formData.get("name") ?? "").trim();
  if (name) patch.name = name;
  if (formData.has("category_id")) patch.category_id = String(formData.get("category_id") ?? "") || null;
  if (Object.keys(patch).length === 0) redirect(back);
  const { error } = await db().from("occupations").update(patch).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

/** Flip an extra field on or off in one click. */
export async function toggleCountryField(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/settings/owners");
  const on = String(formData.get("on") ?? "") === "1";
  const { error } = await db().from("country_fields").update({ active: on }).eq("id", id);
  if (error) fail(back, `Failed to update: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}


/**
 * Hand an owner their app login in one click: username derived from their
 * reference number, the shared starter password, and a forced change on first
 * sign-in.
 */
export async function generateOwnerAppAccess(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/owners/${id}`);

  let q = db().from("owners").select("id, ref, full_name, merchant_id, app_username").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data: owner } = await q.maybeSingle();
  if (!owner) fail(back, "Owner not found");

  // Prefer the reference (TH-OWN-BLG00001 → th-own-blg00001); fall back to the name.
  const base =
    (owner.ref ?? slugify(owner.full_name ?? "owner")).toLowerCase().replace(/[^a-z0-9]+/g, "") || "owner";
  let username = owner.app_username ?? base;
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
  const { error } = await db()
    .from("owners")
    .update({
      app_username: username,
      app_password_hash: await hashPassword(DEFAULT_APP_PASSWORD),
      app_must_change_password: true,
    })
    .eq("id", id);
  if (error) fail(back, `Failed to generate: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=app`);
}

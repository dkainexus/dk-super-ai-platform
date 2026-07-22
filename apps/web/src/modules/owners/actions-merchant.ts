"use server";

// Owners module actions (merchant portal side).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { randomToken } from "@/lib/slug";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";
import type { CountryField, Owner } from "@/lib/types";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Owners ----------

async function getOwnedOwner(ownerId: string, merchantId: string): Promise<Owner> {
  const { data } = await db()
    .from("owners")
    .select("*")
    .eq("id", ownerId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!data) fail("/m/owners", "Owner not found");
  return data as Owner;
}

async function activeFields(countryId: string): Promise<CountryField[]> {
  const { data } = await db()
    .from("country_fields")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort");
  return (data ?? []) as CountryField[];
}

/** Create or update an owner from the dynamic form. Shared by /m/owners/new and edit. */
export async function saveOwner(formData: FormData): Promise<void> {
  const cu = await requireMerchantUser();
  const merchant = cu.merchant;
  await requirePerm("owners", "edit");
  const existingId = String(formData.get("id") ?? "") || null;
  const back = existingId ? `/m/owners/${existingId}` : "/m/owners/new";

  const fullName = String(formData.get("full_name") ?? "").trim();
  const idNumber = String(formData.get("id_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const bankId = String(formData.get("bank_id") ?? "") || null;
  const bankAccountNo = String(formData.get("bank_account_no") ?? "").trim() || null;
  const occupationId = String(formData.get("occupation_id") ?? "") || null;
  const gender = String(formData.get("gender") ?? "") || null;
  const maritalStatus = String(formData.get("marital_status") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!fullName) fail(back, "Please enter the full name");

  let owner: Owner;
  if (existingId) {
    owner = await getOwnedOwner(existingId, merchant.id);
    if (owner.status === "approved") fail(back, "Approved owners cannot be modified");
    const { data } = await db()
      .from("owners")
      .update({
        full_name: fullName,
        id_number: idNumber || null,
        notes,
        bank_id: bankId,
        bank_account_no: bankAccountNo,
        occupation_id: occupationId,
        gender,
        marital_status: maritalStatus,
        phone,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.id)
      .select("*")
      .single();
    owner = data as Owner;
  } else {
    const { data, error } = await db()
      .from("owners")
      .insert({
        merchant_id: merchant.id,
        country_id: merchant.country_id,
        full_name: fullName,
        id_number: idNumber || null,
        notes,
        bank_id: bankId,
        bank_account_no: bankAccountNo,
        occupation_id: occupationId,
        gender,
        marital_status: maritalStatus,
        phone,
        email,
        created_by: cu.user.id,
      })
      .select("*")
      .single();
    if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);
    owner = data as Owner;
  }

  // Built-in ID photos
  const patch: Partial<Owner> = {};
  for (const [field, col] of [
    ["id_front", "id_front_path"],
    ["id_back", "id_back_path"],
    ["photo_full_body", "photo_full_body_path"],
  ] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) fail(back, "Photos must be under 8MB");
      patch[col] = await uploadFile(DOCS_BUCKET, `owners/${owner.id}/${field}.${fileExt(file)}`, file);
    }
  }
  if (Object.keys(patch).length > 0) {
    await db().from("owners").update(patch).eq("id", owner.id);
  }

  // Country custom fields
  const fields = await activeFields(merchant.country_id);
  for (const f of fields) {
    if (f.field_type === "file") {
      const file = formData.get(`cff_${f.id}`);
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024) fail(back, `${f.label} file must be under 8MB`);
        const path = await uploadFile(
          DOCS_BUCKET,
          `owners/${owner.id}/f_${f.field_key}.${fileExt(file)}`,
          file
        );
        await db()
          .from("owner_field_values")
          .upsert(
            { owner_id: owner.id, field_id: f.id, file_path: path, updated_at: new Date().toISOString() },
            { onConflict: "owner_id,field_id" }
          );
      }
    } else {
      const raw = formData.get(`cf_${f.id}`);
      if (raw === null) continue;
      const value = String(raw).trim();
      await db()
        .from("owner_field_values")
        .upsert(
          {
            owner_id: owner.id,
            field_id: f.id,
            value_text: value || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_id,field_id" }
        );
    }
  }

  revalidatePath("/m/owners");
  redirect(`/m/owners/${owner.id}`);
}

/** Validate required fields and move the owner into the review queue. */
export async function submitOwnerForReview(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/m/owners/${id}`;
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(back, "This owner is already approved");
  if (owner.status === "pending") fail(back, "This owner is already pending review");

  const missing: string[] = [];
  if (!owner.full_name) missing.push("Full name");
  if (!owner.id_number) missing.push("ID number");
  if (!owner.id_front_path) missing.push("ID front photo");
  if (!owner.id_back_path) missing.push("ID back photo");
  if (!owner.photo_full_body_path) missing.push("Full-body photo");

  const fields = await activeFields(merchant.country_id);
  const { data: values } = await db()
    .from("owner_field_values")
    .select("field_id, value_text, file_path")
    .eq("owner_id", owner.id);
  const byField = new Map((values ?? []).map((v) => [v.field_id, v]));
  for (const f of fields) {
    if (!f.required) continue;
    const v = byField.get(f.id);
    const has = f.field_type === "file" ? Boolean(v?.file_path) : Boolean(v?.value_text);
    if (!has) missing.push(f.label);
  }

  if (missing.length > 0) fail(back, `Incomplete: missing ${missing.join(", ")}`);

  await db()
    .from("owners")
    .update({
      status: "pending",
      reject_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.id);
  revalidatePath("/m/owners");
  revalidatePath(back);
}

/**
 * One-time Telegram invite: the owner opens t.me/<bot>?start=<token> and the
 * onboarding bot collects the remaining data step by step. Regenerating
 * invalidates the previous link; a rejected owner is reset to draft so the
 * bot flow can resume.
 */
export async function generateOwnerInvite(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("owners", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/m/owners/${id}`;
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(back, "Approved owners do not need an invite link");
  if (owner.status === "pending") fail(back, "This owner is pending review");

  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  await db()
    .from("owners")
    .update({
      invite_token: randomToken(24),
      invite_expires_at: expires.toISOString(),
      status: "draft",
      reject_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.id);
  revalidatePath(back);
}

export async function deleteOwner(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("owners", "delete");
  const id = String(formData.get("id") ?? "");
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(`/m/owners/${id}`, "Approved owners cannot be deleted");
  await db().from("owners").delete().eq("id", owner.id);
  revalidatePath("/m/owners");
  redirect("/m/owners");
}

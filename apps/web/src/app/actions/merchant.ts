"use server";

// Merchant portal actions: branding settings + Owner module.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMerchant } from "@/lib/auth";
import { slugify, randomToken } from "@/lib/slug";
import { uploadFile, fileExt, ASSETS_BUCKET, DOCS_BUCKET } from "@/lib/storage";
import { attachDomain, detachDomain, vercelEnabled } from "@/lib/vercel";
import type { CountryField, Owner } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------- Branding ----------

export async function updateMerchantSettings(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchant();
  const back = "/m/settings";
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase() || null;
  if (!name) fail(back, "名称不能为空");
  if (customDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(customDomain)) fail(back, "域名格式不正确");

  const { error } = await db()
    .from("merchants")
    .update({ name, subdomain, custom_domain: customDomain })
    .eq("id", merchant.id);
  if (error) {
    const msg = error.message.includes("duplicate") ? "该子域名/域名已被占用" : error.message;
    fail(back, `保存失败：${msg}`);
  }

  // Best-effort Vercel routing sync: attach the new custom domain, detach the
  // old one. Status + DNS instructions are rendered live on the settings page.
  if (vercelEnabled() && customDomain !== merchant.custom_domain) {
    if (merchant.custom_domain) await detachDomain(merchant.custom_domain);
    if (customDomain) {
      const r = await attachDomain(customDomain);
      if (!r.ok) fail(back, `域名已保存，但接入失败：${r.error}（可能已被其他网站使用）`);
    }
  }
  revalidatePath("/m", "layout");
}

export async function uploadMerchantLogo(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchant();
  const back = "/m/settings";
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(back, "请选择 logo 文件");
  if (file.size > 2 * 1024 * 1024) fail(back, "logo 不能超过 2MB");

  const path = await uploadFile(ASSETS_BUCKET, `logos/${merchant.id}.${fileExt(file)}`, file);
  await db().from("merchants").update({ logo_path: path }).eq("id", merchant.id);
  revalidatePath("/m", "layout");
}

// ---------- Owners ----------

async function getOwnedOwner(ownerId: string, merchantId: string): Promise<Owner> {
  const { data } = await db()
    .from("owners")
    .select("*")
    .eq("id", ownerId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!data) fail("/m/owners", "Owner 不存在");
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
  const { merchant } = await requireMerchant();
  const existingId = String(formData.get("id") ?? "") || null;
  const back = existingId ? `/m/owners/${existingId}` : "/m/owners/new";

  const fullName = String(formData.get("full_name") ?? "").trim();
  const idNumber = String(formData.get("id_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!fullName) fail(back, "请输入姓名");

  let owner: Owner;
  if (existingId) {
    owner = await getOwnedOwner(existingId, merchant.id);
    if (owner.status === "approved") fail(back, "已通过审核的 Owner 不能修改");
    const { data } = await db()
      .from("owners")
      .update({
        full_name: fullName,
        id_number: idNumber || null,
        notes,
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
      })
      .select("*")
      .single();
    if (error || !data) fail(back, `创建失败：${error?.message ?? "unknown"}`);
    owner = data as Owner;
  }

  // Built-in ID photos
  const patch: Partial<Owner> = {};
  for (const [field, col] of [
    ["id_front", "id_front_path"],
    ["id_back", "id_back_path"],
  ] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) fail(back, "证件照不能超过 8MB");
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
        if (file.size > 8 * 1024 * 1024) fail(back, `${f.label} 文件不能超过 8MB`);
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
  const { merchant } = await requireMerchant();
  const id = String(formData.get("id") ?? "");
  const back = `/m/owners/${id}`;
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(back, "该 Owner 已通过审核");
  if (owner.status === "pending") fail(back, "该 Owner 已在审核队列中");

  const missing: string[] = [];
  if (!owner.full_name) missing.push("姓名");
  if (!owner.id_number) missing.push("ID 号码");
  if (!owner.id_front_path) missing.push("ID 正面照片");
  if (!owner.id_back_path) missing.push("ID 背面照片");

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

  if (missing.length > 0) fail(back, `资料不完整，缺少：${missing.join("、")}`);

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
  const { merchant } = await requireMerchant();
  const id = String(formData.get("id") ?? "");
  const back = `/m/owners/${id}`;
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(back, "已通过审核的 Owner 不需要邀请链接");
  if (owner.status === "pending") fail(back, "该 Owner 正在审核中");

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
  const { merchant } = await requireMerchant();
  const id = String(formData.get("id") ?? "");
  const owner = await getOwnedOwner(id, merchant.id);
  if (owner.status === "approved") fail(`/m/owners/${id}`, "已通过审核的 Owner 不能删除");
  await db().from("owners").delete().eq("id", owner.id);
  revalidatePath("/m/owners");
  redirect("/m/owners");
}

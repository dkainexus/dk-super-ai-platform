"use server";

// Superadmin CMS actions: countries / merchants / custom fields / owner review.
// All guarded by requireAdmin(); the service-role client bypasses RLS.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/slug";
import { uploadFile, fileExt, ASSETS_BUCKET } from "@/lib/storage";
import type { FieldType } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------- Countries ----------

export async function createCountry(formData: FormData): Promise<void> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const flag = String(formData.get("flag") ?? "").trim() || null;
  if (!/^[A-Z]{2}$/.test(code)) fail("/admin/countries", "国家代码需为 2 位字母，例如 TH");
  if (!name) fail("/admin/countries", "请输入国家名称");

  const { error } = await db().from("countries").insert({ code, name, flag });
  if (error) fail("/admin/countries", `创建失败：${error.message}`);
  revalidatePath("/admin/countries");
}

export async function toggleCountry(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("countries").update({ active }).eq("id", id);
  revalidatePath("/admin/countries");
}

// ---------- Custom fields ----------

export async function createCountryField(formData: FormData): Promise<void> {
  await requireAdmin();
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const label = String(formData.get("label") ?? "").trim();
  const rawKey = String(formData.get("field_key") ?? "").trim();
  const fieldType = String(formData.get("field_type") ?? "text") as FieldType;
  const required = formData.get("required") === "on";
  const optionsRaw = String(formData.get("options") ?? "").trim();

  if (!label) fail(back, "请输入字段名称");
  if (!["text", "number", "date", "file", "select"].includes(fieldType)) fail(back, "字段类型无效");

  let fieldKey = slugify(rawKey || label);
  if (!fieldKey) fieldKey = `field_${Date.now().toString(36)}`;

  const options =
    fieldType === "select"
      ? optionsRaw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)
      : [];
  if (fieldType === "select" && options.length === 0) fail(back, "下拉字段需要至少一个选项");

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
  if (error) fail(back, `创建失败：${error.message}`);
  revalidatePath(back);
}

export async function updateCountryField(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const label = String(formData.get("label") ?? "").trim();
  const required = formData.get("required") === "on";
  const sort = parseInt(String(formData.get("sort") ?? "100"), 10) || 100;
  const active = formData.get("active") === "on";
  if (!label) fail(back, "字段名称不能为空");

  await db().from("country_fields").update({ label, required, sort, active }).eq("id", id);
  revalidatePath(back);
}

export async function deleteCountryField(formData: FormData): Promise<void> {
  await requireAdmin();
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
  await requireAdmin();
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) fail(back, "请输入商家名称");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "登录用户名需 3-30 位字母数字");
  if (password.length < 6) fail(back, "初始密码至少 6 位");

  // Username must be unique across both login tables (staff wins at login).
  const { data: staffClash } = await db().from("staff").select("id").ilike("username", username).maybeSingle();
  const { data: muClash } = await db().from("merchant_users").select("id").ilike("username", username).maybeSingle();
  if (staffClash || muClash) fail(back, "该用户名已被占用");

  const { data: merchant, error } = await db()
    .from("merchants")
    .insert({ country_id: countryId, name, subdomain })
    .select("id")
    .single();
  if (error || !merchant) fail(back, `创建失败：${error?.message ?? "unknown"}`);

  const { error: uerr } = await db().from("merchant_users").insert({
    merchant_id: merchant.id,
    username,
    password_hash: await hashPassword(password),
    name,
  });
  if (uerr) {
    await db().from("merchants").delete().eq("id", merchant.id);
    fail(back, `创建登录账号失败：${uerr.message}`);
  }
  revalidatePath(back);
  redirect(`/admin/merchants/${merchant.id}`);
}

export async function updateMerchantByAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const status = String(formData.get("status") ?? "active");
  if (!name) fail(back, "商家名称不能为空");

  const { error } = await db()
    .from("merchants")
    .update({ name, subdomain, status: status === "suspended" ? "suspended" : "active" })
    .eq("id", id);
  if (error) fail(back, `保存失败：${error.message}`);
  revalidatePath(back);
}

export async function createMerchantUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(back, "用户名需 3-30 位字母数字");
  if (password.length < 6) fail(back, "初始密码至少 6 位");

  const { data: staffClash } = await db().from("staff").select("id").ilike("username", username).maybeSingle();
  const { data: muClash } = await db().from("merchant_users").select("id").ilike("username", username).maybeSingle();
  if (staffClash || muClash) fail(back, "该用户名已被占用");

  const { error } = await db().from("merchant_users").insert({
    merchant_id: merchantId,
    username,
    password_hash: await hashPassword(password),
    name,
  });
  if (error) fail(back, `创建失败：${error.message}`);
  revalidatePath(back);
}

export async function resetMerchantUserPassword(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) fail(back, "新密码至少 6 位");

  await db()
    .from("merchant_users")
    .update({ password_hash: await hashPassword(password), must_change_password: true })
    .eq("id", id);
  revalidatePath(back);
}

export async function toggleMerchantUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("merchant_users").update({ active }).eq("id", id);
  revalidatePath(`/admin/merchants/${merchantId}`);
}

export async function uploadMerchantLogoByAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(back, "请选择 logo 文件");
  if (file.size > 2 * 1024 * 1024) fail(back, "logo 不能超过 2MB");

  const path = await uploadFile(ASSETS_BUCKET, `logos/${id}.${fileExt(file)}`, file);
  await db().from("merchants").update({ logo_path: path }).eq("id", id);
  revalidatePath(back);
}

// ---------- Owner review ----------

export async function reviewOwner(formData: FormData): Promise<void> {
  const staff = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const back = `/admin/owners/${id}`;
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (decision !== "approved" && decision !== "rejected") fail(back, "无效操作");
  if (decision === "rejected" && !reason) fail(back, "请填写拒绝原因");

  const { data: owner } = await db()
    .from("owners")
    .update({
      status: decision,
      reject_reason: decision === "rejected" ? reason : null,
      reviewed_by: staff.id,
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
      requested_by: { source: "web", staff_id: staff.id },
    });
  }
  revalidatePath("/admin/owners");
  revalidatePath(back);
}

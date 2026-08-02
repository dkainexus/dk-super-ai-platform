"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { platformSettings, setSetting, globalModuleToggles } from "@/lib/settings";
import { TOGGLABLE_MODULES } from "@/modules/registry";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

export async function savePlatformSettings(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("/admin/settings", "Platform name cannot be empty");
  const current = await platformSettings();
  await setSetting("platform", { ...current, name });
  revalidatePath("/", "layout");
}

export async function uploadPlatformLogo(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail("/admin/settings", "Please choose a logo file");
  if (file.size > 2 * 1024 * 1024) fail("/admin/settings", "Logo must be under 2MB");
  const { uploadFile, fileExt, ASSETS_BUCKET } = await import("@/lib/storage");
  const path = await uploadFile(ASSETS_BUCKET, `platform/logo.${fileExt(file)}`, file);
  const current = await platformSettings();
  await setSetting("platform", { ...current, logo_path: path });
  revalidatePath("/", "layout");
}

export async function uploadPlatformFavicon(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const file = formData.get("favicon");
  if (!(file instanceof File) || file.size === 0) fail("/admin/settings", "Please choose an icon file");
  if (file.size > 1 * 1024 * 1024) fail("/admin/settings", "Favicon must be under 1MB");
  const { uploadFile, fileExt, ASSETS_BUCKET } = await import("@/lib/storage");
  const path = await uploadFile(ASSETS_BUCKET, `platform/favicon.${fileExt(file)}`, file);
  const current = await platformSettings();
  await setSetting("platform", { ...current, favicon_path: path });
  revalidatePath("/", "layout");
}

export async function saveCreditSettings(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const usdtPerCredit = parseFloat(String(formData.get("usdt_per_credit") ?? "").replace(/,/g, ""));
  const perApproval = parseInt(String(formData.get("credits_per_approval") ?? ""), 10);
  const address = String(formData.get("usdt_address_trc20") ?? "").trim();
  if (!Number.isFinite(usdtPerCredit) || usdtPerCredit <= 0) fail("/admin/settings", "Enter the USDT price per credit");
  if (!Number.isFinite(perApproval) || perApproval < 0) fail("/admin/settings", "Enter the credits per approval");
  if (address && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) fail("/admin/settings", "That doesn't look like a TRC20 address");
  await setSetting("credits", {
    usdt_per_credit: usdtPerCredit,
    credits_per_approval: perApproval,
    usdt_address_trc20: address,
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function removePlatformFavicon(): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const current = await platformSettings();
  await setSetting("platform", { ...current, favicon_path: null });
  revalidatePath("/", "layout");
}

export async function removePlatformLogo(): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const current = await platformSettings();
  await setSetting("platform", { ...current, logo_path: null });
  revalidatePath("/", "layout");
}

/** Global module toggles: checkbox mod_<key> per togglable module. */
export async function saveModuleToggles(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const toggles = await globalModuleToggles();
  for (const m of TOGGLABLE_MODULES) {
    toggles[m.key] = formData.get(`mod_${m.key}`) === "on";
  }
  await setSetting("modules", toggles);
  revalidatePath("/", "layout");
  redirect("/admin/modules");
}


/** Flip one module on/off (global). */
export async function toggleModule(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const key = String(formData.get("key") ?? "");
  const toggles = await globalModuleToggles();
  toggles[key] = String(formData.get("on") ?? "") === "1";
  await setSetting("modules", toggles);
  revalidatePath("/", "layout");
  redirect("/admin/modules");
}

/** Per-merchant module opt-outs, edited on the merchant detail page. */
export async function saveMerchantModules(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = `/admin/merchants/${merchantId}`;
  const disabled = TOGGLABLE_MODULES.filter((m) => formData.get(`mod_${m.key}`) !== "on").map((m) => m.key);
  const { error } = await db().from("merchants").update({ disabled_modules: disabled }).eq("id", merchantId);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  revalidatePath("/", "layout");
}


/** The TrackingMore key — masked values keep the stored key. */
export async function saveTrackingKey(formData: FormData): Promise<void> {
  await requirePerm("settings", "edit");
  const raw = String(formData.get("trackingmore_key") ?? "").trim();
  const { getSetting, setSetting } = await import("@/lib/settings");
  const current = await getSetting<{ trackingmore_key?: string }>("shipping", {});
  if (raw.startsWith("\u2022")) {
    redirect("/admin/settings");
  }
  await setSetting("shipping", { ...current, trackingmore_key: raw || undefined });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

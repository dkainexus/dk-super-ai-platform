"use server";

// White Label portal actions: branding settings (name / logo / domains).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { uploadFile, fileExt, ASSETS_BUCKET } from "@/lib/storage";
import { attachDomain, detachDomain, vercelEnabled } from "@/lib/vercel";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Branding ----------

export async function updateMerchantSettings(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("settings", "edit");
  const back = "/m/settings";
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = slugify(String(formData.get("subdomain") ?? "").trim()).replace(/_/g, "-") || null;
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase() || null;
  if (!name) fail(back, "Name cannot be empty");
  if (customDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(customDomain)) fail(back, "Invalid domain format");

  const { error } = await db()
    .from("merchants")
    .update({ name, subdomain, custom_domain: customDomain })
    .eq("id", merchant.id);
  if (error) {
    const msg = error.message.includes("duplicate") ? "This subdomain/domain is already taken" : error.message;
    fail(back, `Failed to save: ${msg}`);
  }

  // Best-effort Vercel routing sync: attach the new custom domain, detach the
  // old one. Status + DNS instructions are rendered live on the settings page.
  if (vercelEnabled() && customDomain !== merchant.custom_domain) {
    if (merchant.custom_domain) await detachDomain(merchant.custom_domain);
    if (customDomain) {
      const r = await attachDomain(customDomain);
      if (!r.ok) fail(back, `Domain saved but attach failed: ${r.error} (it may already be in use elsewhere)`);
    }
  }
  revalidatePath("/m", "layout");
}

export async function uploadMerchantLogo(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("settings", "edit");
  const back = "/m/settings";
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(back, "Please choose a logo file");
  if (file.size > 2 * 1024 * 1024) fail(back, "Logo must be under 2MB");

  const path = await uploadFile(ASSETS_BUCKET, `logos/${merchant.id}.${fileExt(file)}`, file);
  await db().from("merchants").update({ logo_path: path }).eq("id", merchant.id);
  revalidatePath("/m", "layout");
}


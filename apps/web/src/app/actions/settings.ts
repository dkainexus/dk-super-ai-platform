"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { setSetting, globalModuleToggles } from "@/lib/settings";
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
  await setSetting("platform", { name });
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

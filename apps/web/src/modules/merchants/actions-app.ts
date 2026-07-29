"use server";

// Branded mobile apps: each white label gets its own name, icon and Android
// package so several brands can live on one phone. Builds are queued here and
// picked up by the build agent running on the build server.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { ASSETS_BUCKET, fileExt, uploadFile } from "@/lib/storage";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function packageFor(name: string, fallback: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || fallback;
  return `group.dkglobal.${slug}`;
}

export async function saveAppSettings(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const appName = String(formData.get("app_name") ?? "").trim();
  if (!appName) fail(back, "Please enter the app name");

  const { data: m } = await db().from("merchants").select("subdomain, app_package_id").eq("id", id).maybeSingle();
  const { error } = await db()
    .from("merchants")
    .update({
      app_name: appName,
      // The package id is fixed once set — changing it would orphan installs.
      app_package_id: m?.app_package_id ?? packageFor(appName, (m?.subdomain ?? id).replace(/-/g, "")),
    })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function uploadAppIcon(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;
  const file = formData.get("icon");
  if (!(file instanceof File) || file.size === 0) fail(back, "Please choose an image");
  if (!file.type.startsWith("image/")) fail(back, "The icon must be an image");
  try {
    const path = await uploadFile(ASSETS_BUCKET, `app-icons/${id}.${fileExt(file)}`, file);
    await db().from("merchants").update({ app_icon_path: path }).eq("id", id);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Icon upload failed");
  }
  revalidatePath(back);
  redirect(back);
}

export async function removeAppIcon(formData: FormData): Promise<void> {
  await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const { data: m } = await db().from("merchants").select("app_icon_path").eq("id", id).maybeSingle();
  if (m?.app_icon_path) await db().storage.from(ASSETS_BUCKET).remove([m.app_icon_path]);
  await db().from("merchants").update({ app_icon_path: null }).eq("id", id);
  revalidatePath(`/admin/merchants/${id}`);
  redirect(`/admin/merchants/${id}`);
}

/** Queue a branded build — the build agent picks it up within a minute. */
export async function queueAppBuild(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("merchants", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/merchants/${id}`;

  const { data: m } = await db().from("merchants").select("app_name, app_package_id").eq("id", id).maybeSingle();
  if (!m?.app_name || !m.app_package_id) fail(back, "Set the app name first");

  const { data: last } = await db()
    .from("app_builds")
    .select("version_code")
    .eq("merchant_id", id)
    .order("version_code", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionCode = (last?.version_code ?? 0) + 1;

  const { error } = await db().from("app_builds").insert({
    merchant_id: id,
    version_code: versionCode,
    version_name: `1.${versionCode}.0`,
    status: "queued",
    requested_by: cu.user.id,
  });
  if (error) fail(back, `Failed to queue: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

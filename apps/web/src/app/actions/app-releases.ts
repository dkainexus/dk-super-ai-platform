"use server";

// Mobile app release management (platform settings). APKs are uploaded
// straight from the browser to Supabase Storage via signed upload URLs.

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";

function fail(message: string): never {
  redirect(`/admin/settings/app?error=${encodeURIComponent(message)}`);
}

/** Mint a signed upload URL for a new APK. */
export async function createReleaseUpload(): Promise<{ path: string; url: string } | { error: string }> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) return { error: "Platform only" };
  const path = `apk/${randomUUID()}.apk`;
  const { data, error } = await db().storage.from("app-releases").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not create upload URL" };
  return { path, url: data.signedUrl };
}

/** Record a release after the APK upload finished. */
export async function saveRelease(input: {
  versionCode: number;
  versionName: string;
  notes: string;
  apkPath: string;
  published: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) return { error: "Platform only" };
  if (!Number.isInteger(input.versionCode) || input.versionCode <= 0) return { error: "Version code must be a positive integer" };
  if (!input.versionName.trim()) return { error: "Please enter a version name" };
  if (!input.apkPath) return { error: "APK file is missing" };

  const { error } = await db().from("app_releases").insert({
    version_code: input.versionCode,
    version_name: input.versionName.trim(),
    notes: input.notes.trim() || null,
    apk_path: input.apkPath,
    published: input.published,
    created_by: cu.user.id,
  });
  if (error) {
    return { error: error.message.includes("duplicate") ? "This version code already exists" : error.message };
  }
  revalidatePath("/admin/settings/app");
  return { ok: true };
}

/** Publish / unpublish a release (the app offers the highest published one). */
export async function toggleRelease(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  await db().from("app_releases").update({ published }).eq("id", id);
  revalidatePath("/admin/settings/app");
}

export async function deleteRelease(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const { data } = await db().from("app_releases").select("apk_path").eq("id", id).maybeSingle();
  if (data?.apk_path) await db().storage.from("app-releases").remove([data.apk_path]);
  const { error } = await db().from("app_releases").delete().eq("id", id);
  if (error) fail(`Failed to delete: ${error.message}`);
  revalidatePath("/admin/settings/app");
}

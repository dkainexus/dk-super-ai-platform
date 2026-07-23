"use server";

// Training module actions. Video files are uploaded straight from the browser
// to Supabase Storage via signed upload URLs (server actions only mint the URL
// and record metadata), so large files never pass through the Next.js server.

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { activeCountry } from "@/modules/merchants/lib";
import { TRAINING_BUCKET } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** Mint a signed upload URL for a new video or thumbnail file. */
export async function createTrainingUpload(input: {
  kind: "video" | "thumb";
  ext: string;
}): Promise<{ path: string; url: string } | { error: string }> {
  await requirePerm("training", "add");
  const ext = input.ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${input.kind === "video" ? "videos" : "thumbs"}/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(TRAINING_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not create upload URL" };
  return { path, url: data.signedUrl };
}

/** Record a video row after the browser finished uploading the file. */
export async function saveTrainingVideo(input: {
  title: string;
  description: string;
  merchantId: string | null;
  countryId: string | null;
  videoPath: string;
  thumbPath: string | null;
  durationSeconds: number | null;
  published: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { cu } = await requirePerm("training", "add");
  const title = input.title.trim();
  if (!title) return { error: "Please enter a title" };
  if (!input.videoPath) return { error: "Video file is missing" };

  let merchantId = input.merchantId || null;
  let countryId = input.countryId || null;
  if (cu.merchant) {
    // Portal uploads always belong to the merchant's active country workspace.
    merchantId = cu.merchant.id;
    const { active } = await activeCountry(cu);
    if (!active) return { error: "No active country" };
    countryId = active.id;
  }

  const { count } = await db()
    .from("training_videos")
    .select("id", { count: "exact", head: true });
  const { error } = await db().from("training_videos").insert({
    merchant_id: merchantId,
    country_id: countryId,
    title,
    description: input.description.trim() || null,
    video_path: input.videoPath,
    thumb_path: input.thumbPath,
    duration_seconds: input.durationSeconds,
    sort: ((count ?? 0) + 1) * 10,
    published: input.published,
    created_by: cu.user.id,
  });
  if (error) return { error: `Failed to save: ${error.message}` };
  revalidatePath("/admin/training");
  revalidatePath("/m/training");
  return { ok: true };
}

export async function updateTrainingVideo(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("training", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/training");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) fail(back, "Title cannot be empty");

  const patch: Record<string, unknown> = {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    sort: parseInt(String(formData.get("sort") ?? "100"), 10) || 100,
    published: formData.get("published") === "on",
    updated_at: new Date().toISOString(),
  };
  if (!cu.merchant) {
    patch.merchant_id = String(formData.get("merchant_id") ?? "") || null;
    patch.country_id = String(formData.get("country_id") ?? "") || null;
  }

  let q = db().from("training_videos").update(patch).eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id); // only their own videos
  const { error } = await q;
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/training");
  revalidatePath("/m/training");
  redirect(back);
}

export async function deleteTrainingVideo(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("training", "delete");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/training");

  let q = db().from("training_videos").select("*").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data: video } = await q.maybeSingle();
  if (video) {
    const paths = [video.video_path, video.thumb_path].filter(Boolean) as string[];
    if (paths.length) await db().storage.from(TRAINING_BUCKET).remove(paths);
    await db().from("training_videos").delete().eq("id", id);
  }
  revalidatePath("/admin/training");
  revalidatePath("/m/training");
  redirect(back);
}

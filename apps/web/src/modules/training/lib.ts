import "server-only";
import { db } from "@/lib/supabase";
import { signedUrl } from "@/lib/storage";
import type { Owner, TrainingVideo } from "@/lib/types";

export const TRAINING_BUCKET = "training-videos";

/** Published videos visible to one owner (global + their white label / country). */
export async function videosForOwner(owner: Owner): Promise<TrainingVideo[]> {
  const { data } = await db()
    .from("training_videos")
    .select("*")
    .eq("published", true)
    .or(`merchant_id.is.null,merchant_id.eq.${owner.merchant_id}`)
    .or(`country_id.is.null,country_id.eq.${owner.country_id}`)
    .order("sort")
    .order("created_at");
  return (data ?? []) as TrainingVideo[];
}

/** Watch progress rows for an owner keyed by video id. */
export async function progressForOwner(
  ownerId: string
): Promise<Record<string, { seconds_watched: number; completed_at: string | null }>> {
  const { data } = await db()
    .from("training_progress")
    .select("video_id, seconds_watched, completed_at")
    .eq("owner_id", ownerId);
  const map: Record<string, { seconds_watched: number; completed_at: string | null }> = {};
  for (const r of (data ?? []) as { video_id: string; seconds_watched: number; completed_at: string | null }[]) {
    map[r.video_id] = { seconds_watched: r.seconds_watched, completed_at: r.completed_at };
  }
  return map;
}

/** Short-lived signed playback URL for a video. */
export async function videoPlaybackUrl(video: TrainingVideo, expiresIn = 3600): Promise<string | null> {
  return signedUrl(TRAINING_BUCKET, video.video_path, expiresIn);
}

export type VideoStats = { watching: number; completed: number };

/**
 * Per-video watch counts for the owners in scope: how many people have started
 * a video and how many finished it.
 */
export async function videoStats(opts: {
  videoIds: string[];
  countryId?: string;
  merchantId?: string;
}): Promise<Map<string, VideoStats>> {
  const stats = new Map<string, VideoStats>();
  for (const id of opts.videoIds) stats.set(id, { watching: 0, completed: 0 });
  if (opts.videoIds.length === 0) return stats;

  let oq = db().from("owners").select("id");
  if (opts.countryId) oq = oq.eq("country_id", opts.countryId);
  if (opts.merchantId) oq = oq.eq("merchant_id", opts.merchantId);
  const { data: owners } = await oq;
  const ownerIds = ((owners ?? []) as { id: string }[]).map((o) => o.id);
  if (ownerIds.length === 0) return stats;

  const { data } = await db()
    .from("training_progress")
    .select("video_id, completed_at")
    .in("video_id", opts.videoIds)
    .in("owner_id", ownerIds);

  for (const r of (data ?? []) as { video_id: string; completed_at: string | null }[]) {
    const s = stats.get(r.video_id);
    if (!s) continue;
    if (r.completed_at) s.completed++;
    else s.watching++;
  }
  return stats;
}

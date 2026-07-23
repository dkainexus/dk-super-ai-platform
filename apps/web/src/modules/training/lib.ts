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

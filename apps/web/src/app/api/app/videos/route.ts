import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { signedUrl } from "@/lib/storage";
import { videosForOwner, progressForOwner, TRAINING_BUCKET } from "@/modules/training/lib";

// GET /api/app/videos → training videos visible to this owner (with progress).
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("training", toggles, owner.merchant, owner.country)) {
    return Response.json({ videos: [] });
  }

  const [videos, progress] = await Promise.all([videosForOwner(owner), progressForOwner(owner.id)]);
  const out = [];
  for (const v of videos) {
    out.push({
      id: v.id,
      title: v.title,
      description: v.description,
      duration_seconds: v.duration_seconds,
      thumb_url: await signedUrl(TRAINING_BUCKET, v.thumb_path, 3600),
      seconds_watched: progress[v.id]?.seconds_watched ?? 0,
      completed: Boolean(progress[v.id]?.completed_at),
    });
  }
  return Response.json({ videos: out });
}

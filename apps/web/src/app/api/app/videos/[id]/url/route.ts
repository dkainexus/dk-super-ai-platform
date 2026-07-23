import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { videosForOwner, videoPlaybackUrl } from "@/modules/training/lib";

// GET /api/app/videos/:id/url → short-lived signed playback URL.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  // Visibility check: the video must be in this owner's published set.
  const videos = await videosForOwner(owner);
  const video = videos.find((v) => v.id === id);
  if (!video) return Response.json({ error: "Not found" }, { status: 404 });

  const url = await videoPlaybackUrl(video, 3600 * 3);
  if (!url) return Response.json({ error: "File missing" }, { status: 404 });
  return Response.json({ url });
}

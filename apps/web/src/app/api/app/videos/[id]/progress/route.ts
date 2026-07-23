import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";

// POST /api/app/videos/:id/progress  { seconds, completed } → upsert progress.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  let body: { seconds?: number; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const seconds = Math.max(0, Math.round(Number(body.seconds ?? 0))) || 0;

  const { data: existing } = await db()
    .from("training_progress")
    .select("seconds_watched, completed_at")
    .eq("owner_id", owner.id)
    .eq("video_id", id)
    .maybeSingle();

  const { error } = await db().from("training_progress").upsert(
    {
      owner_id: owner.id,
      video_id: id,
      seconds_watched: Math.max(seconds, existing?.seconds_watched ?? 0),
      completed_at: body.completed
        ? existing?.completed_at ?? new Date().toISOString()
        : existing?.completed_at ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,video_id" }
  );
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

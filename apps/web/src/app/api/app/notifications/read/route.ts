import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";

// POST /api/app/notifications/read  { id? } → mark one (or all) as read.
export async function POST(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let q = db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("owner_id", owner.id)
    .is("read_at", null);
  if (body.id) q = q.eq("id", body.id);
  const { error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

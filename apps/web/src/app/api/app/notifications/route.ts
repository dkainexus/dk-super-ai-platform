import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import type { AppNotification } from "@/lib/types";

// GET /api/app/notifications → this owner's notifications, newest first.
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const { data } = await db()
    .from("notifications")
    .select("id, type, title, body, read_at, created_at")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (data ?? []) as Pick<AppNotification, "id" | "type" | "title" | "body" | "read_at" | "created_at">[];
  return Response.json({
    notifications: list,
    unread: list.filter((n) => !n.read_at).length,
  });
}

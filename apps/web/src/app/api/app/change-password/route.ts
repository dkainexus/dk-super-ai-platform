import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { hashPassword, verifyPassword } from "@/lib/password";

// POST /api/app/change-password { current?, next }
// Used by the first-sign-in prompt and by Profile later on.
export async function POST(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  let body: { current?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const next = String(body.next ?? "");
  if (next.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  // While the starter password is in force we don't ask for it again.
  if (!owner.app_must_change_password) {
    const current = String(body.current ?? "");
    if (!owner.app_password_hash || !(await verifyPassword(current, owner.app_password_hash))) {
      return Response.json({ error: "Current password is wrong" }, { status: 400 });
    }
  }

  const { error } = await db()
    .from("owners")
    .update({ app_password_hash: await hashPassword(next), app_must_change_password: false })
    .eq("id", owner.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

import { db } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { signOwnerToken } from "@/lib/app-auth";
import type { Merchant, Owner } from "@/lib/types";

// POST /api/app/login  { username, password } → { token, owner }
export async function POST(req: Request): Promise<Response> {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  const { data } = await db()
    .from("owners")
    .select("*, merchant:merchants(*)")
    .ilike("app_username", username)
    .maybeSingle();
  const owner = data as (Owner & { merchant: Merchant }) | null;

  const invalid = () => Response.json({ error: "Wrong username or password" }, { status: 401 });
  if (!owner?.app_password_hash) return invalid();
  if (!(await verifyPassword(password, owner.app_password_hash))) return invalid();
  if (owner.status === "banned") return Response.json({ error: "This account is disabled" }, { status: 403 });
  if (owner.merchant?.status !== "active") {
    return Response.json({ error: "This account is disabled" }, { status: 403 });
  }

  await db().from("owners").update({ app_last_login_at: new Date().toISOString() }).eq("id", owner.id);
  const token = await signOwnerToken(owner.id);
  return Response.json({
    token,
    // The app sends the user straight to "change your password" when this is set.
    must_change_password: owner.app_must_change_password === true,
    owner: { id: owner.id, name: owner.full_name, username: owner.app_username },
  });
}

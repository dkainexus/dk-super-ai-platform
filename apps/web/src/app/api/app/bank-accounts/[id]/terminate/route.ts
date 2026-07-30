import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";

// POST /api/app/bank-accounts/[id]/terminate → the owner asks to stop this
// account. Nothing stops here: the admin negotiates the agent's compensation
// and decides — the request is the paper trail.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();
  const { id } = await params;

  const { data: acc } = await db()
    .from("bank_accounts")
    .select("id, merchant_id, country_id, status")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();
  if (!acc) return Response.json({ error: "Account not found" }, { status: 404 });
  if (acc.status === "closed") return Response.json({ error: "This account is already closed" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const { error } = await db().from("termination_requests").insert({
    merchant_id: acc.merchant_id,
    country_id: acc.country_id,
    owner_id: owner.id,
    bank_account_id: id,
    reason: String(body.reason ?? "").trim() || null,
  });
  if (error) {
    return Response.json(
      { error: /duplicate|unique/i.test(error.message) ? "A request for this account is already pending" : error.message },
      { status: 400 }
    );
  }
  return Response.json({ ok: true, message: "Request submitted — we will contact you after reviewing it." });
}

import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";

// GET /api/app/bank-accounts/options → companies + banks for the submit form.
// Companies: ones the owner is a member of; fallback to their merchant+country list.

export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const { data: memberships } = await db()
    .from("company_members")
    .select("company_id")
    .eq("owner_id", owner.id);
  const memberIds = ((memberships ?? []) as { company_id: string }[]).map((m) => m.company_id);

  let cq = db()
    .from("companies")
    .select("id, name")
    .eq("merchant_id", owner.merchant_id)
    .neq("status", "banned")
    .order("name");
  if (memberIds.length > 0) cq = cq.in("id", memberIds);
  else cq = cq.eq("country_id", owner.country_id);

  const [{ data: companies }, { data: banks }] = await Promise.all([
    cq,
    db()
      .from("banks")
      .select("id, name, code, account_fields, channels")
      .eq("active", true)
      .eq("country_id", owner.country_id)
      .order("sort")
      .order("name"),
  ]);

  return Response.json({
    companies: (companies ?? []) as { id: string; name: string }[],
    banks: ((banks ?? []) as {
      id: string; name: string; code: string | null;
      account_fields: { key: string; label: string }[]; channels: string[];
    }[]),
  });
}

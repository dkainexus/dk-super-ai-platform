import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { db } from "@/lib/supabase";

// GET /api/app/tasks → tickets assigned to this owner, deadlines first.
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const { data: accounts } = await db().from("bank_accounts").select("id").eq("owner_id", owner.id);
  const ids = ((accounts ?? []) as { id: string }[]).map((a) => a.id);
  if (ids.length === 0) return Response.json({ tasks: [] });

  const { data } = await db()
    .from("tickets")
    .select(
      "id, ref, description, status, deadline, escort_required, escort_name, created_at, bank_account:bank_accounts(account_no, bank:banks(name)), type:ticket_types(name)"
    )
    .in("bank_account_id", ids)
    .eq("assigned_to", "owner")
    .order("status")
    .order("deadline");

  return Response.json({
    tasks: ((data ?? []) as unknown as {
      id: string; ref: string | null; description: string; status: string; deadline: string | null;
      escort_required: boolean; escort_name: string | null; created_at: string;
      bank_account: { account_no: string; bank: { name: string } | null } | null;
      type: { name: string } | null;
    }[]).map((t) => ({
      id: t.id,
      ref: t.ref,
      type: t.type?.name ?? null,
      description: t.description,
      status: t.status,
      deadline: t.deadline,
      escort: t.escort_required ? t.escort_name : null,
      account: t.bank_account ? `${t.bank_account.bank?.name ?? "?"} ${t.bank_account.account_no}` : null,
      created_at: t.created_at,
    })),
  });
}

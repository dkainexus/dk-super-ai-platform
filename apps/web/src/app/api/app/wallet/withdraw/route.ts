import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { walletApply, walletForOwner } from "@/modules/wallet/lib";

// POST /api/app/wallet/withdraw { amount } → hold the funds and create a
// pending withdrawal for the back office to pay out manually.
export async function POST(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Please enter a valid amount" }, { status: 400 });
  }
  if (!owner.bank_id || !owner.bank_account_no) {
    return Response.json(
      { error: "No bank account on file — contact your agent to add one first" },
      { status: 400 }
    );
  }

  const wallet = await walletForOwner(owner.id);
  if (!wallet || wallet.balance < amount) {
    return Response.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Only one pending withdrawal at a time keeps the queue clean.
  const { count: pending } = await db()
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .eq("status", "pending");
  if ((pending ?? 0) > 0) {
    return Response.json({ error: "You already have a pending withdrawal" }, { status: 400 });
  }

  const { data: bank } = await db().from("banks").select("name").eq("id", owner.bank_id).maybeSingle();

  // Hold the funds (atomic — refuses if the balance changed concurrently).
  try {
    await walletApply({
      ownerId: owner.id,
      currency: wallet.currency,
      type: "withdrawal",
      amount: -amount,
      note: "Withdrawal request",
    });
  } catch {
    return Response.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const { data: withdrawal, error } = await db()
    .from("withdrawals")
    .insert({
      wallet_id: wallet.id,
      owner_id: owner.id,
      amount,
      currency: wallet.currency,
      bank_name: bank?.name ?? null,
      bank_account_no: owner.bank_account_no,
    })
    .select("*")
    .single();
  if (error || !withdrawal) {
    // Roll the hold back if the request row failed.
    await walletApply({
      ownerId: owner.id,
      currency: wallet.currency,
      type: "refund",
      amount,
      note: "Withdrawal request failed — refund",
    });
    return Response.json({ error: "Failed to create the withdrawal" }, { status: 500 });
  }

  return Response.json({ ok: true, withdrawal });
}

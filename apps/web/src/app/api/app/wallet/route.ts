import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import { walletForOwner, walletTransactions, withdrawalsForOwner } from "@/modules/wallet/lib";

// GET /api/app/wallet → balance + recent transactions + withdrawals.
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const wallet = await walletForOwner(owner.id);
  const [transactions, withdrawals, bank] = await Promise.all([
    wallet ? walletTransactions(wallet.id) : Promise.resolve([]),
    withdrawalsForOwner(owner.id),
    owner.bank_id
      ? db().from("banks").select("name").eq("id", owner.bank_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return Response.json({
    balance: wallet?.balance ?? 0,
    currency: wallet?.currency ?? owner.country?.currency ?? "THB",
    bank: bank?.name ?? null,
    bank_account_no: owner.bank_account_no ?? null,
    transactions,
    withdrawals,
  });
}

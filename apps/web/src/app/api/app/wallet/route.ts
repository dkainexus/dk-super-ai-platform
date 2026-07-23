import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";
import {
  trainingRewardOffer,
  walletForOwner,
  walletTransactions,
  withdrawalsForOwner,
} from "@/modules/wallet/lib";

// GET /api/app/wallet → balance + transactions + withdrawals + reward list
// (received = credited reward transactions, pending = offers not yet earned).
export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const wallet = await walletForOwner(owner.id);
  const [transactions, withdrawals, bank, offer] = await Promise.all([
    wallet ? walletTransactions(wallet.id) : Promise.resolve([]),
    withdrawalsForOwner(owner.id),
    owner.bank_id
      ? db().from("banks").select("name").eq("id", owner.bank_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    trainingRewardOffer(owner),
  ]);

  const received = transactions
    .filter((t) => t.type === "reward")
    .map((t) => ({ id: t.id, title: t.note ?? "Reward", amount: t.amount, date: t.created_at }));
  const trainingGranted = transactions.some((t) => t.reference === "training_complete");
  const pending =
    offer && !trainingGranted
      ? [
          {
            id: "training",
            title: "Complete all training videos",
            amount: offer.amount,
            progress: { completed: offer.completed, total: offer.total },
          },
        ]
      : [];

  return Response.json({
    balance: wallet?.balance ?? 0,
    currency: wallet?.currency ?? owner.country?.currency ?? "THB",
    bank: bank?.name ?? null,
    bank_account_no: owner.bank_account_no ?? null,
    transactions,
    withdrawals,
    rewards: { pending, received },
  });
}

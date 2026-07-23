import "server-only";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { notifyOwner } from "@/modules/notifications/lib";
import type { Wallet, WalletTransaction, WalletTxType, Withdrawal } from "@/lib/types";

// Wallet module core. All balance changes go through the wallet_apply
// Postgres function — atomic, creates the wallet on first use, refuses
// debits below zero, and enforces idempotency via the reference key.

export type WalletSettings = { training_rewards: Record<string, number> }; // countryId -> amount

export async function walletSettings(): Promise<WalletSettings> {
  const stored = await getSetting<Partial<WalletSettings>>("wallet", {});
  return { training_rewards: stored.training_rewards ?? {} };
}

/** Apply a signed amount to an owner's wallet. Throws on insufficient funds
 *  or duplicate reference. Returns the wallet id. */
export async function walletApply(opts: {
  ownerId: string;
  currency: string;
  type: WalletTxType;
  amount: number;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<string> {
  const { data, error } = await db().rpc("wallet_apply", {
    p_owner: opts.ownerId,
    p_currency: opts.currency,
    p_type: opts.type,
    p_amount: opts.amount,
    p_reference: opts.reference ?? null,
    p_note: opts.note ?? null,
    p_created_by: opts.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function walletForOwner(ownerId: string): Promise<Wallet | null> {
  const { data } = await db().from("wallets").select("*").eq("owner_id", ownerId).maybeSingle();
  return (data as Wallet) ?? null;
}

export async function walletTransactions(walletId: string, limit = 50): Promise<WalletTransaction[]> {
  const { data } = await db()
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as WalletTransaction[];
}

export async function withdrawalsForOwner(ownerId: string, limit = 20): Promise<Withdrawal[]> {
  const { data } = await db()
    .from("withdrawals")
    .select("*")
    .eq("owner_id", ownerId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Withdrawal[];
}

/**
 * Training-completion reward: when the owner has completed every published
 * training video visible to them, credit the configured amount for their
 * country — once (reference-keyed). Called from the app progress endpoint.
 */
export async function maybeGrantTrainingReward(owner: {
  id: string;
  merchant_id: string;
  country_id: string;
  country: { currency: string };
}): Promise<boolean> {
  const settings = await walletSettings();
  const amount = settings.training_rewards[owner.country_id] ?? 0;
  if (amount <= 0) return false;

  // All published videos visible to this owner (global or their merchant/country).
  const { data: videos } = await db()
    .from("training_videos")
    .select("id, merchant_id, country_id")
    .eq("published", true);
  const visible = ((videos ?? []) as { id: string; merchant_id: string | null; country_id: string | null }[]).filter(
    (v) =>
      (v.merchant_id === null || v.merchant_id === owner.merchant_id) &&
      (v.country_id === null || v.country_id === owner.country_id)
  );
  if (visible.length === 0) return false;

  const { data: done } = await db()
    .from("training_progress")
    .select("video_id")
    .eq("owner_id", owner.id)
    .not("completed_at", "is", null);
  const doneSet = new Set(((done ?? []) as { video_id: string }[]).map((d) => d.video_id));
  if (!visible.every((v) => doneSet.has(v.id))) return false;

  try {
    await walletApply({
      ownerId: owner.id,
      currency: owner.country.currency,
      type: "reward",
      amount,
      reference: "training_complete",
      note: "Training completion reward",
    });
  } catch (e) {
    // Duplicate reference = already rewarded; anything else bubbles up.
    if (e instanceof Error && /duplicate|unique/i.test(e.message)) return false;
    throw e;
  }
  await notifyOwner(
    owner.id,
    "reward",
    "Training reward credited 🎉",
    `You completed all training videos — ${amount.toLocaleString()} ${owner.country.currency} has been added to your wallet.`
  );
  return true;
}

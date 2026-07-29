import "server-only";
import { db } from "@/lib/supabase";
import { notifyOwner } from "@/modules/notifications/lib";
import type { Wallet, WalletTransaction, WalletTxType, Withdrawal } from "@/lib/types";

// Wallet module core. All balance changes go through the wallet_apply
// Postgres function — atomic, creates the wallet on first use, refuses
// debits below zero, and enforces idempotency via the reference key.

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
  merchantId?: string | null;
}): Promise<string> {
  const { data, error } = await db().rpc("wallet_apply", {
    p_owner: opts.ownerId,
    p_currency: opts.currency,
    p_type: opts.type,
    p_amount: opts.amount,
    p_reference: opts.reference ?? null,
    p_note: opts.note ?? null,
    p_created_by: opts.createdBy ?? null,
    p_merchant: opts.merchantId ?? null,
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

/** Rewards an owner can still unlock: published videos and exams that pay. */
export async function pendingRewards(owner: {
  id: string;
  merchant_id: string;
  country_id: string;
}): Promise<{ id: string; title: string; amount: number }[]> {
  const [{ data: videos }, { data: exams }, { data: done }, { data: passed }] = await Promise.all([
    db().from("training_videos").select("id, title, reward_amount, merchant_id, country_id").eq("published", true),
    db().from("exams").select("id, title, reward_amount, merchant_id, country_id").eq("published", true),
    db().from("training_progress").select("video_id").eq("owner_id", owner.id).not("completed_at", "is", null),
    db().from("exam_attempts").select("exam_id").eq("owner_id", owner.id).eq("passed", true),
  ]);
  const visible = <T extends { merchant_id: string | null; country_id: string | null }>(rows: T[]) =>
    rows.filter(
      (r) =>
        (r.merchant_id === null || r.merchant_id === owner.merchant_id) &&
        (r.country_id === null || r.country_id === owner.country_id)
    );
  const doneSet = new Set(((done ?? []) as { video_id: string }[]).map((d) => d.video_id));
  const passedSet = new Set(((passed ?? []) as { exam_id: string }[]).map((a) => a.exam_id));

  const out: { id: string; title: string; amount: number }[] = [];
  for (const v of visible((videos ?? []) as { id: string; title: string; reward_amount: number | null; merchant_id: string | null; country_id: string | null }[])) {
    if (Number(v.reward_amount) > 0 && !doneSet.has(v.id)) {
      out.push({ id: `video:${v.id}`, title: `Finish “${v.title}”`, amount: Number(v.reward_amount) });
    }
  }
  for (const e of visible((exams ?? []) as { id: string; title: string; reward_amount: number | null; merchant_id: string | null; country_id: string | null }[])) {
    if (Number(e.reward_amount) > 0 && !passedSet.has(e.id)) {
      out.push({ id: `exam:${e.id}`, title: `Pass “${e.title}”`, amount: Number(e.reward_amount) });
    }
  }
  return out;
}

/**
 * Pay the reward attached to a training video or exam — once per owner
 * (reference-keyed) and recorded against the owner's white label.
 */
export async function grantReward(
  owner: { id: string; merchant_id: string; country: { currency: string } },
  item: { kind: "video" | "exam"; id: string; title: string; reward_amount: number | null; auto_notify: boolean }
): Promise<boolean> {
  const amount = Number(item.reward_amount ?? 0);
  if (!(amount > 0)) return false;

  try {
    await walletApply({
      ownerId: owner.id,
      currency: owner.country.currency,
      type: "reward",
      amount,
      reference: `${item.kind}_${item.id}`,
      note: item.kind === "video" ? `Training reward — ${item.title}` : `Exam reward — ${item.title}`,
      merchantId: owner.merchant_id,
    });
  } catch (e) {
    if (e instanceof Error && /duplicate|unique/i.test(e.message)) return false;
    throw e;
  }

  if (item.auto_notify) {
    await notifyOwner(
      owner.id,
      "reward",
      "Reward credited 🎉",
      `${amount.toLocaleString()} ${owner.country.currency} for ${item.kind === "video" ? "finishing" : "passing"} “${item.title}”.`
    ).catch(() => {});
  }
  return true;
}

// ---------- Reporting ----------

export type LedgerRow = WalletTransaction & {
  wallet: { owner_id: string; currency: string } | null;
  owner: { full_name: string | null; ref: string | null } | null;
  merchant: { name: string } | null;
};

/** Full ledger for a country (or a single white label), newest first. */
export async function ledger(opts: {
  countryId?: string | null;
  merchantId?: string | null;
  type?: string;
  from: number;
  to: number;
}): Promise<{ rows: LedgerRow[]; total: number }> {
  let q = db()
    .from("wallet_transactions")
    .select(
      "*, wallet:wallets!inner(owner_id, currency, owner:owners!inner(full_name, ref, country_id)), merchant:merchants(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(opts.from, opts.to);
  if (opts.countryId) q = q.eq("wallet.owner.country_id", opts.countryId);
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.type) q = q.eq("type", opts.type);
  const { data, count } = await q;
  const rows = ((data ?? []) as unknown as (WalletTransaction & {
    wallet: { owner_id: string; currency: string; owner: { full_name: string | null; ref: string | null } } | null;
    merchant: { name: string } | null;
  })[]).map((r) => ({
    ...r,
    wallet: r.wallet ? { owner_id: r.wallet.owner_id, currency: r.wallet.currency } : null,
    owner: r.wallet?.owner ?? null,
    merchant: r.merchant,
  }));
  return { rows: rows as LedgerRow[], total: count ?? rows.length };
}

/** Totals per white label — rewards are recorded against the earner's brand. */
export async function merchantTotals(countryId: string | null): Promise<
  { merchant_id: string | null; name: string; credited: number; withdrawn: number; balance: number }[]
> {
  let q = db()
    .from("wallet_transactions")
    .select("amount, type, merchant_id, merchant:merchants(name), wallet:wallets!inner(owner:owners!inner(country_id))");
  if (countryId) q = q.eq("wallet.owner.country_id", countryId);
  const { data } = await q;
  const byMerchant = new Map<string, { merchant_id: string | null; name: string; credited: number; withdrawn: number; balance: number }>();
  for (const r of (data ?? []) as unknown as {
    amount: number; type: string; merchant_id: string | null; merchant: { name: string } | null;
  }[]) {
    const key = r.merchant_id ?? "none";
    const entry = byMerchant.get(key) ?? {
      merchant_id: r.merchant_id,
      name: r.merchant?.name ?? "(no white label)",
      credited: 0,
      withdrawn: 0,
      balance: 0,
    };
    const amount = Number(r.amount);
    if (amount >= 0) entry.credited += amount;
    else entry.withdrawn += -amount;
    entry.balance += amount;
    byMerchant.set(key, entry);
  }
  return [...byMerchant.values()].sort((a, b) => b.credited - a.credited);
}

import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { manualCredit } from "@/modules/wallet/actions";
import { WithdrawalsQueue } from "@/modules/wallet/components/withdrawals-queue";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import type { Owner, Wallet, Withdrawal } from "@/lib/types";

// White label wallet view: their owners' balances and withdrawal requests,
// scoped to the active country.
export default async function MerchantWalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("wallet", "view");
  if (!cu.merchant) redirect("/admin/wallets");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("wallet", toggles, cu.merchant, active)) redirect("/m");
  const { error } = await searchParams;
  const canAdd = can(cu, "wallet", "add");
  const canEdit = Boolean(can(cu, "wallet", "edit"));

  let oq = db()
    .from("owners")
    .select("id, full_name, status")
    .eq("merchant_id", cu.merchant.id);
  if (active) oq = oq.eq("country_id", active.id);
  const { data: owners } = await oq;
  const ownerIds = ((owners ?? []) as Owner[]).map((o) => o.id);
  const ownerNames = new Map(((owners ?? []) as Owner[]).map((o) => [o.id, o.full_name ?? "(no name)"]));

  const [{ data: wallets }, { data: withdrawals }] = ownerIds.length
    ? await Promise.all([
        db().from("wallets").select("*").in("owner_id", ownerIds).order("balance", { ascending: false }),
        db().from("withdrawals").select("*").in("owner_id", ownerIds).order("requested_at", { ascending: false }).limit(50),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Wallets{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">Your owners&apos; wallet balances and withdrawal requests.</p>
      </div>
      <ErrorBanner message={error} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Withdrawals</h2>
        <WithdrawalsQueue
          withdrawals={(withdrawals ?? []) as Withdrawal[]}
          ownerNames={ownerNames}
          canProcess={canEdit}
          back="/m/wallets"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Balances</h2>
        <div className="card divide-y divide-border">
          {(wallets ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No wallets yet.</p>}
          {((wallets ?? []) as Wallet[]).map((w) => (
            <div key={w.id} className="flex items-center justify-between px-5 py-3.5">
              <p className="text-sm font-medium">{ownerNames.get(w.owner_id) ?? "(unknown)"}</p>
              <p className="mono-num text-lg font-semibold">
                {w.balance.toLocaleString()} <span className="text-xs text-muted">{w.currency}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Manual Credit</h2>
          <p className="mb-4 text-xs text-muted">Credit a reward or rent into one of your owners&apos; wallets.</p>
          <form action={manualCredit} className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem_1fr_auto] sm:items-end">
            <input type="hidden" name="back" value="/m/wallets" />
            <div>
              <label className="mb-1 block text-xs text-muted">Owner</label>
              <select name="owner_id" className="input" required>
                <option value="">— Select an owner —</option>
                {((owners ?? []) as Owner[])
                  .filter((o) => o.status !== "banned")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name ?? "(no name)"}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Type</label>
              <select name="type" className="input">
                <option value="reward">Reward</option>
                <option value="rent">Rent</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Amount</label>
              <input name="amount" type="number" step="0.01" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Note (optional)</label>
              <input name="note" className="input" />
            </div>
            <ActionButton icon="plus" tip="Credit this amount into the owner's wallet" label="Credit" variant="primary" />
          </form>
        </section>
      )}
    </div>
  );
}

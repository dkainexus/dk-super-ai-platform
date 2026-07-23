import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { manualCredit } from "@/modules/wallet/actions";
import { OwnerPicker } from "@/modules/wallet/components/owner-picker";
import { WithdrawalsQueue } from "@/modules/wallet/components/withdrawals-queue";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import type { Owner, Wallet, Withdrawal } from "@/lib/types";

// Platform wallet center: withdrawal queue (the money you owe people) on
// top, balances + manual credit below.
export default async function AdminWalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("wallet", "view");
  const { error, status = "" } = await searchParams;
  const canAdd = can(cu, "wallet", "add");
  const canEdit = Boolean(can(cu, "wallet", "edit"));

  let wq = db().from("withdrawals").select("*").order("requested_at", { ascending: false }).limit(100);
  if (status) wq = wq.eq("status", status);
  const [{ data: withdrawals }, { data: wallets }, { data: owners }] = await Promise.all([
    wq,
    db().from("wallets").select("*").order("balance", { ascending: false }),
    db().from("owners").select("id, full_name, merchant_id, country_id, status, merchant:merchants(name), country:countries(flag, name)"),
  ]);

  const ownerById = new Map(
    ((owners ?? []) as unknown as (Owner & { merchant: { name: string } | null })[]).map((o) => [o.id, o])
  );
  const ownerNames = new Map(
    ((owners ?? []) as unknown as Owner[]).map((o) => [o.id, o.full_name ?? "(no name)"])
  );
  const pendingCount = ((withdrawals ?? []) as Withdrawal[]).filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Wallets</h1>
        <p className="mt-1 text-sm text-muted">
          Owner wallets and withdrawal processing. Transfer manually, then mark the request paid.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Withdrawals{pendingCount > 0 ? ` — ${pendingCount} pending` : ""}
          </h2>
          <div className="ml-auto flex gap-2">
            {[["", "All"], ["pending", "Pending"], ["paid", "Paid"], ["rejected", "Rejected"]].map(([v, label]) => (
              <a
                key={v}
                href={`/admin/wallets${v ? `?status=${v}` : ""}`}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  status === v
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-muted hover:border-accent hover:text-foreground"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <WithdrawalsQueue
          withdrawals={(withdrawals ?? []) as Withdrawal[]}
          ownerNames={ownerNames}
          canProcess={canEdit}
          back="/admin/wallets"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Balances</h2>
        <div className="card divide-y divide-border">
          {(wallets ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No wallets yet — the first credit creates one.</p>
          )}
          {((wallets ?? []) as Wallet[]).map((w) => {
            const owner = ownerById.get(w.owner_id);
            return (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{owner?.full_name ?? "(unknown)"}</p>
                  <p className="text-xs text-muted">{(owner as { merchant?: { name?: string } } | undefined)?.merchant?.name ?? "—"}</p>
                </div>
                <p className="mono-num text-lg font-semibold">
                  {w.balance.toLocaleString()} <span className="text-xs text-muted">{w.currency}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Manual Credit</h2>
          <p className="mb-4 text-xs text-muted">
            Credit a reward or rent into an owner&apos;s wallet (adjustments may be negative). The owner is notified.
          </p>
          <form action={manualCredit} className="grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_1fr_7rem_7rem_1fr_auto]">
            <input type="hidden" name="back" value="/admin/wallets" />
            <OwnerPicker
              owners={((owners ?? []) as unknown as (Owner & { merchant: { name: string } | null; country: { flag: string | null; name: string } | null })[])
                .filter((o) => o.status !== "banned")
                .map((o) => ({
                  id: o.id,
                  name: o.full_name ?? "(no name)",
                  merchant_id: o.merchant_id,
                  merchant_name: o.merchant?.name ?? "—",
                  country_id: o.country_id ?? null,
                  country_name: o.country ? `${o.country.flag ?? ""} ${o.country.name}`.trim() : "—",
                }))}
            />
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

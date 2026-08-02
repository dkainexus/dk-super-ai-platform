import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { creditBalance, creditConfig, creditLedger } from "@/modules/merchants/credits";
import { buyCreditsWithTx } from "@/modules/merchants/credit-actions";
import { CopyField } from "@/components/copy-field";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

const REASON_LABEL: Record<string, string> = {
  topup: "Top-up",
  approval: "Approval",
  manual: "Adjustment",
};

// The white label's credit account: balance, USDT top-up, and the ledger.
export default async function MerchantCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("settings", "view");
  const { error, saved } = await searchParams;

  const [balance, cfg, ledger] = await Promise.all([
    creditBalance(cu.merchant.id),
    creditConfig(),
    creditLedger(cu.merchant.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Credits</h1>
        <p className="mt-1 text-sm text-muted">
          Approving an agent&apos;s submission costs {cfg.credits_per_approval}{" "}
          credit{cfg.credits_per_approval === 1 ? "" : "s"}. Buy credits by sending USDT and reporting the
          transaction — the chain confirms it, credits land instantly.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          ✅ Verified on chain — {saved} credit{saved === "1" ? "" : "s"} added.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <p className="text-[11px] uppercase tracking-wide text-muted">Balance</p>
          <p className="mono-num mt-2 text-4xl font-semibold">{fmtNum(balance)}</p>
          <p className="mt-1 text-xs text-muted">credits</p>
        </div>
        <div className="card p-6">
          <p className="text-[11px] uppercase tracking-wide text-muted">Price</p>
          <p className="mono-num mt-2 text-4xl font-semibold">{fmtNum(cfg.usdt_per_credit)}</p>
          <p className="mt-1 text-xs text-muted">USDT per credit (TRC20)</p>
        </div>
      </div>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Top up with USDT</h2>
          <p className="mt-1 text-xs text-muted">
            Send USDT (TRC20) to the address below, then paste the transaction hash — amounts convert at{" "}
            {fmtNum(cfg.usdt_per_credit)} USDT per credit, whole credits only.
          </p>
        </div>
        {cfg.usdt_address_trc20 ? (
          <>
            <CopyField value={cfg.usdt_address_trc20} />
            <form action={buyCreditsWithTx} className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-muted">Transaction hash</label>
                <input
                  name="tx_hash"
                  className="input mono-num"
                  placeholder="64-character transaction hash"
                  autoComplete="off"
                  required
                />
              </div>
              <ActionButton icon="check" tip="Verify on chain and add the credits" label="Verify & Add" variant="primary" />
            </form>
            <p className="text-xs text-muted">Only transfers from the last 7 days are accepted; a hash can be used once.</p>
          </>
        ) : (
          <p className="text-sm text-warning">Top-ups are not open yet — contact the platform.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">History</h2>
        <Table head={["Date", "Type", "Credits", "USDT", "Note"]}>
          {ledger.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-muted">No activity yet.</td>
            </tr>
          )}
          {ledger.map((e) => (
            <tr key={e.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-muted">{e.created_at.slice(0, 10)}</td>
              <td className="px-4 py-2.5">{REASON_LABEL[e.reason] ?? e.reason}</td>
              <td className={`mono-num px-4 py-2.5 font-medium ${e.delta >= 0 ? "text-success" : "text-danger"}`}>
                {e.delta >= 0 ? "+" : ""}
                {fmtNum(e.delta)}
              </td>
              <td className="mono-num px-4 py-2.5 text-muted">{e.usdt_amount != null ? fmtNum(e.usdt_amount) : "—"}</td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {e.tx_hash ? `${e.tx_hash.slice(0, 10)}…` : e.note ?? "—"}
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}

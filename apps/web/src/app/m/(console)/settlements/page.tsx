import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { computeSettlements } from "@/modules/billing/settlement";
import { ledgerFor } from "@/modules/billing/ledger";
import { fmtNum } from "@/lib/format";

// The white label's own statement: their accounts, their asking prices, their
// share. What we actually charge a customer above the asking price is our
// business and never rendered here.
export default async function MerchantSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("billing", "view");
  const sp = await searchParams;
  const { active } = await activeCountry(cu);
  if (!active) return <p className="card px-5 py-6 text-sm text-muted">No country selected.</p>;

  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : new Date().toISOString().slice(0, 7);
  const period = `${month}-01`;

  const [statements, wallet, { data: settled }] = await Promise.all([
    computeSettlements(active.id, period),
    ledgerFor("merchant", cu.merchant.id),
    db()
      .from("settlements")
      .select("net_amount, created_at")
      .eq("merchant_id", cu.merchant.id)
      .eq("country_id", active.id)
      .eq("period_month", period)
      .maybeSingle(),
  ]);
  const s = statements.find((x) => x.merchant_id === cu.merchant.id) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Settlements — {active.flag || ""} {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Your monthly statement, settled on each account&apos;s asking price. Approved statements land in your wallet.
        </p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Wallet balance</p>
          <p className="mono-num mt-1 text-2xl font-semibold">
            {fmtNum(wallet.balance)} {wallet.currency ?? active.currency}
          </p>
        </div>
        <form action="/m/settlements">
          <label className="mb-1 block text-xs text-muted">Month</label>
          <input name="month" type="month" defaultValue={month} className="input mono-num" data-autosubmit />
        </form>
      </div>

      {!s && <p className="card px-5 py-6 text-sm text-muted">Nothing settled or billed for {month}.</p>}

      {s && (
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{month} statement</h2>
            <div className="flex items-center gap-3">
              <p className="mono-num text-lg font-semibold">
                {fmtNum(s.wl_net)} {active.currency}
              </p>
              {settled ? (
                <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[11px] text-success">
                  settled {new Date((settled as { created_at: string }).created_at).toLocaleDateString()}
                </span>
              ) : (
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning">
                  awaiting approval
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Asking Price</th>
                  <th className="px-3 py-2 text-right">Months Billed</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">Owner Paid</th>
                  <th className="px-3 py-2 text-right">Agent Paid</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                  <th className="px-3 py-2 text-right">Your Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.accounts.map((a) => (
                  <tr key={a.bank_account_id}>
                    <td className="px-3 py-2">
                      {a.label}
                      {a.own_use && <span className="ml-2 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted">own use</span>}
                      {a.warning && <p className="text-[11px] text-danger">{a.warning}</p>}
                    </td>
                    <td className="mono-num px-3 py-2 text-right">{a.asking_price != null ? fmtNum(a.asking_price) : "—"}</td>
                    <td className="mono-num px-3 py-2 text-right">{a.fraction}</td>
                    <td className="mono-num px-3 py-2 text-right">{fmtNum(a.asking_revenue)}</td>
                    <td className="mono-num px-3 py-2 text-right">{fmtNum(a.owner_paid)}</td>
                    <td className="mono-num px-3 py-2 text-right">{fmtNum(a.agent_paid)}</td>
                    <td className={`mono-num px-3 py-2 text-right ${a.profit < 0 ? "text-danger" : ""}`}>{fmtNum(a.profit)}</td>
                    <td className="mono-num px-3 py-2 text-right font-semibold">{fmtNum(a.wl_takes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-lg bg-surface-raised px-4 py-2.5">
              <span className="text-muted">Setup fees (your share)</span>
              <span className="mono-num">{fmtNum(s.setup_wl_takes)} of {fmtNum(s.setup_fees)}</span>
            </div>
            {s.compensation_chargebacks > 0 && (
              <div className="flex justify-between rounded-lg bg-surface-raised px-4 py-2.5">
                <span className="text-muted">Compensation to your customers</span>
                <span className="mono-num text-danger">−{fmtNum(s.compensation_chargebacks)}</span>
              </div>
            )}
            <div className="flex justify-between rounded-lg bg-surface-raised px-4 py-2.5 font-semibold sm:col-span-2">
              <span>Net for {month}</span>
              <span className="mono-num">{fmtNum(s.wl_net)} {active.currency}</span>
            </div>
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Wallet Activity</h2>
        <div className="divide-y divide-border">
          {wallet.entries.length === 0 && <p className="py-3 text-sm text-muted">No wallet activity yet.</p>}
          {wallet.entries.slice(0, 15).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-muted">
                {e.note ?? e.kind}
                <span className="ml-2 text-xs">{new Date(e.created_at).toLocaleDateString()}</span>
              </span>
              <span className={`mono-num ${Number(e.amount) >= 0 ? "text-success" : "text-danger"}`}>
                {Number(e.amount) >= 0 ? "+" : ""}
                {fmtNum(e.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

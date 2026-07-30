import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { computeSettlements } from "@/modules/billing/settlement";
import { approveSettlement } from "@/modules/billing/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

// The white labels' month: per-account splits on their asking prices, setup
// fee shares, and their own customers' compensation coming off their side.
export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; month?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("billing", "view");
  const sp = await searchParams;
  const { error, saved } = sp;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : new Date().toISOString().slice(0, 7);
  const period = `${month}-01`;
  const [statements, { data: settled }] = await Promise.all([
    computeSettlements(active.id, period),
    db().from("settlements").select("merchant_id, net_amount, created_at").eq("country_id", active.id).eq("period_month", period),
  ]);
  const settledBy = new Map(
    ((settled ?? []) as { merchant_id: string; net_amount: number; created_at: string }[]).map((s) => [s.merchant_id, s])
  );
  const canEdit = Boolean(can(cu, "billing", "edit"));
  const back = `/admin/billing/settlements?month=${month}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/billing" className="text-xs text-muted hover:text-foreground">← Billing</Link>
        <h1 className="mt-1 text-xl font-semibold">White Label Settlements — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Everything settles on the asking price. What we actually charge a customer above it never appears here.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Settled — the net is in the white label&apos;s wallet.
        </p>
      )}

      <form className="card flex items-end gap-3 p-5" action="/admin/billing/settlements">
        <div>
          <label className="mb-1 block text-xs text-muted">Month</label>
          <input name="month" type="month" defaultValue={month} className="input mono-num" data-autosubmit />
        </div>
        <p className="pb-2 text-xs text-muted">Built from that month&apos;s issued invoices.</p>
      </form>

      {statements.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">Nothing to settle for {month}.</p>
      )}

      {statements.map((s) => {
        const done = settledBy.get(s.merchant_id);
        return (
          <section key={s.merchant_id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{s.merchant_name}</h2>
              <div className="flex items-center gap-3">
                <p className="mono-num text-lg font-semibold">
                  {fmtNum(s.wl_net)} {active.currency}
                </p>
                {done ? (
                  <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[11px] text-success">
                    settled {new Date(done.created_at).toLocaleDateString()}
                  </span>
                ) : (
                  canEdit && (
                    <form action={approveSettlement}>
                      <input type="hidden" name="merchant_id" value={s.merchant_id} />
                      <input type="hidden" name="period_month" value={period} />
                      <input type="hidden" name="back" value={back} />
                      <ActionButton
                        icon="check"
                        tip="Lock this statement and credit the net to their wallet"
                        label="Approve & Pay"
                        variant="success"
                      />
                    </form>
                  )
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Asking</th>
                    <th className="px-3 py-2 text-right">Owner</th>
                    <th className="px-3 py-2 text-right">Agent</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-right">We Take</th>
                    <th className="px-3 py-2 text-right">They Take</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {s.accounts.map((a) => (
                    <tr key={a.bank_account_id}>
                      <td className="px-3 py-2">
                        {a.label}
                        {a.own_use && <span className="ml-2 text-[10px] text-muted">(own use — flat fee)</span>}
                        {a.warning && <span className="ml-2 text-[10px] text-danger">{a.warning}</span>}
                        {a.days < a.days_in_month && (
                          <span className="mono-num ml-2 text-[10px] text-muted">{a.days}/{a.days_in_month} days</span>
                        )}
                      </td>
                      <td className="mono-num px-3 py-2 text-right">{fmtNum(a.asking_revenue)}</td>
                      <td className="mono-num px-3 py-2 text-right text-danger">−{fmtNum(a.owner_paid)}</td>
                      <td className="mono-num px-3 py-2 text-right text-danger">−{fmtNum(a.agent_paid)}</td>
                      <td className="mono-num px-3 py-2 text-right">{fmtNum(a.profit)}</td>
                      <td className="mono-num px-3 py-2 text-right">{fmtNum(a.we_take)}</td>
                      <td className="mono-num px-3 py-2 text-right font-medium">{fmtNum(a.wl_takes)}</td>
                    </tr>
                  ))}
                  {s.setup_fees > 0 && (
                    <tr>
                      <td className="px-3 py-2 text-muted" colSpan={4}>Setup fees collected</td>
                      <td className="mono-num px-3 py-2 text-right">{fmtNum(s.setup_fees)}</td>
                      <td className="mono-num px-3 py-2 text-right">{fmtNum(s.setup_we_take)}</td>
                      <td className="mono-num px-3 py-2 text-right font-medium">{fmtNum(s.setup_wl_takes)}</td>
                    </tr>
                  )}
                  {s.compensation_chargebacks > 0 && (
                    <tr>
                      <td className="px-3 py-2 text-muted" colSpan={6}>
                        Compensation to their customers (their loss)
                      </td>
                      <td className="mono-num px-3 py-2 text-right text-danger">
                        −{fmtNum(s.compensation_chargebacks)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

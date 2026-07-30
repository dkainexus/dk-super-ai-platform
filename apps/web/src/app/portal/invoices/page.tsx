import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { type InvoiceRow } from "@/modules/billing/lib";
import { topupRequestsFor } from "@/modules/billing/topup";
import { submitTopUpRequest } from "@/modules/billing/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  issued: "border-warning/40 bg-warning/10 text-warning",
  paid: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};

// What the customer owes and has paid — each invoice with its full working.
export default async function PortalInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error, saved } = await searchParams;

  const [{ data }, { data: country }, topups] = await Promise.all([
    db()
      .from("invoices")
      .select("*, invoice_lines(*)")
      .eq("customer_id", c.id)
      .neq("status", "draft")
      .order("period_month", { ascending: false }),
    db().from("countries").select("usdt_address_trc20").eq("id", c.country_id ?? "").maybeSingle(),
    topupRequestsFor({ customerId: c.id }),
  ]);
  const rows = (data ?? []) as unknown as (InvoiceRow & { usdt_total?: number | null })[];
  const owed = rows.filter((r) => r.status === "issued").reduce((s, r) => s + Number(r.total), 0);
  const { ledgerFor } = await import("@/modules/billing/ledger");
  const wallet = await ledgerFor("customer", c.id);
  const depositAddress = (country?.usdt_address_trc20 as string | null) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">
          {owed > 0
            ? `Outstanding: ${fmtNum(owed)} ${rows[0]?.currency ?? ""}`
            : "Nothing outstanding."}{" "}
          Wallet balance: <span className="mono-num">{fmtNum(wallet.balance)} {wallet.currency ?? rows[0]?.currency ?? ""}</span>.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "credited" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Confirmed on chain — your wallet has been credited.
        </p>
      )}
      {saved === "submitted" && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          Received — we&apos;re confirming it on chain. It credits automatically once confirmed.
        </p>
      )}

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Top Up (USDT · TRC20)</h2>
        {depositAddress ? (
          <>
            <p className="mb-1 text-xs text-muted">Send USDT on the TRON network to:</p>
            <p className="mono-num mb-3 break-all rounded-lg bg-surface-raised px-3 py-2 text-sm">{depositAddress}</p>
            <form action={submitTopUpRequest} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div>
                <label className="mb-1 block text-xs text-muted">Transaction hash</label>
                <input name="tx_hash" className="input mono-num" placeholder="64-character hash from your wallet" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Amount (USDT)</label>
                <input name="amount_usdt" className="input mono-num" placeholder="optional" />
              </div>
              <ActionButton
                icon="check"
                tip="We verify the transfer on chain — once confirmed it credits your wallet at the day's rate"
                label="I've Paid"
                variant="primary"
              />
            </form>
          </>
        ) : (
          <p className="text-sm text-muted">Contact support for the deposit address.</p>
        )}
        {topups.length > 0 && (
          <div className="mt-4 divide-y divide-border border-t border-border">
            {topups.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="mono-num max-w-[50%] truncate text-xs text-muted" title={t.tx_hash}>{t.tx_hash}</span>
                <span className="flex items-center gap-2">
                  {t.chain_usdt != null && <span className="mono-num text-xs">{fmtNum(t.chain_usdt)} USDT</span>}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[t.status === "credited" ? "paid" : t.status === "rejected" ? "cancelled" : "issued"] ?? ""}`}
                    title={t.verify_note ?? ""}
                  >
                    {t.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing billed yet.</p>}

      {rows.map((inv) => (
        <section key={inv.id} className="card p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">
              <span className="mono-num">{inv.ref ?? "Invoice"}</span>
              <span className="ml-2 font-normal text-muted">{inv.period_month.slice(0, 7)}</span>
            </p>
            <span className="flex items-center gap-2">
              {inv.usdt_total != null && inv.status === "issued" && (
                <span className="mono-num text-xs text-muted">{fmtNum(inv.usdt_total)} USDT</span>
              )}
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[inv.status] ?? ""}`}>
                {inv.status}
              </span>
            </span>
          </div>
          <Table head={["Line", "Amount"]}>
            {inv.invoice_lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="mono-num px-4 py-2.5 text-right">{fmtNum(l.amount)}</td>
              </tr>
            ))}
            <tr className="bg-surface-raised">
              <td className="px-4 py-2.5 font-semibold">Total</td>
              <td className="mono-num px-4 py-2.5 text-right font-semibold">
                {fmtNum(inv.total)} {inv.currency}
              </td>
            </tr>
          </Table>
        </section>
      ))}
    </div>
  );
}

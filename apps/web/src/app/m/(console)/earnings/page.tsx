import { redirect } from "next/navigation";
import { requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { agentForUser } from "@/modules/agents/lib";
import { ledgerFor } from "@/modules/billing/ledger";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  issued: "border-warning/40 bg-warning/10 text-warning",
  paid: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};

// The agent's own page: what we owe them, what they owe us, and how their
// network is doing — owners recruited, accounts live.
export default async function AgentEarningsPage() {
  const cu = await requireMerchantUser();
  const agent = await agentForUser(cu.user.id);
  if (!agent) redirect("/m");

  const [{ data: owners }, wallet, { data: invoices }] = await Promise.all([
    db()
      .from("owners")
      .select("id, status")
      .eq("merchant_id", agent.merchant_id)
      .eq("created_by", cu.user.id),
    ledgerFor("agent", agent.id),
    db()
      .from("invoices")
      .select("id, ref, period_month, total, currency, status, paid_at")
      .eq("agent_id", agent.id)
      .eq("party_type", "agent")
      .neq("status", "draft")
      .order("period_month", { ascending: false })
      .limit(24),
  ]);

  const ownerRows = (owners ?? []) as { id: string; status: string }[];
  const ownerIds = ownerRows.map((o) => o.id);
  const { data: accounts } = ownerIds.length
    ? await db().from("bank_accounts").select("id, status").in("owner_id", ownerIds)
    : { data: [] };
  const accountRows = (accounts ?? []) as { id: string; status: string }[];

  const invoiceRows = (invoices ?? []) as {
    id: string; ref: string | null; period_month: string; total: number; currency: string; status: string;
    paid_at: string | null;
  }[];
  const pendingPay = invoiceRows.filter((i) => i.status === "issued").reduce((s, i) => s + Number(i.total), 0);
  const debt = Math.min(0, wallet.balance);

  const stat = (label: string, value: string, sub?: string) => (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mono-num mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">My Business</h1>
        <p className="mt-1 text-sm text-muted">
          {agent.full_name}
          {agent.ref && <span className="mono-num ml-2 rounded bg-surface-raised px-1.5 py-0.5 text-[11px]">{agent.ref}</span>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Owners recruited", fmtNum(ownerRows.length), `${ownerRows.filter((o) => o.status === "approved").length} approved`)}
        {stat("Accounts", fmtNum(accountRows.length), `${accountRows.filter((a) => a.status === "active").length} active`)}
        {stat(
          "Being paid",
          `${fmtNum(pendingPay)} ${invoiceRows[0]?.currency ?? ""}`,
          "issued, not yet paid out"
        )}
        {stat(
          debt < 0 ? "You owe" : "Balance",
          `${fmtNum(Math.abs(wallet.balance))} ${wallet.currency ?? invoiceRows[0]?.currency ?? ""}`,
          debt < 0 ? "recovered from your future payouts" : undefined
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Rent Payouts</h2>
        <Table head={["ID", "Month", "Total", "Status", "Paid"]}>
          {invoiceRows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-muted">Nothing billed yet.</td>
            </tr>
          )}
          {invoiceRows.map((inv) => (
            <tr key={inv.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{inv.ref ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">{inv.period_month.slice(0, 7)}</td>
              <td className="mono-num px-4 py-2.5">{fmtNum(inv.total)} {inv.currency}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[inv.status] ?? ""}`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted">
                {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </Table>
        <p className="text-xs text-muted">Payouts are made in USDT — contact us to update your receiving address.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Account Activity</h2>
        <div className="divide-y divide-border">
          {wallet.entries.length === 0 && <p className="py-3 text-sm text-muted">Nothing on record.</p>}
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

import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";
import type { Owner, Wallet, Withdrawal } from "@/lib/types";

// The white label's read-only money picture: what has been credited to their
// owners, what has been withdrawn and paid, what is still requested or
// sitting in balances. Crediting and paying out is the platform's hand.
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

  let oq = db()
    .from("owners")
    .select("id, full_name, status")
    .eq("merchant_id", cu.merchant.id);
  if (active) oq = oq.eq("country_id", active.id);
  const { data: owners } = await oq;
  const ownerIds = ((owners ?? []) as Owner[]).map((o) => o.id);
  const ownerNames = new Map(((owners ?? []) as Owner[]).map((o) => [o.id, o.full_name ?? "(no name)"]));

  const [{ data: wallets }, { data: withdrawals }, { data: credits }] = ownerIds.length
    ? await Promise.all([
        db().from("wallets").select("*").in("owner_id", ownerIds).order("balance", { ascending: false }),
        db().from("withdrawals").select("*").in("owner_id", ownerIds).order("requested_at", { ascending: false }).limit(50),
        db()
          .from("wallet_transactions")
          .select("amount, wallet:wallets!inner(owner_id)")
          .gt("amount", 0)
          .in("wallets.owner_id", ownerIds)
          .limit(2000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const currency = ((wallets ?? []) as Wallet[])[0]?.currency ?? active?.currency ?? "";
  const totalCredited = ((credits ?? []) as { amount: number }[]).reduce((s, t) => s + Number(t.amount), 0);
  const paidOut = ((withdrawals ?? []) as Withdrawal[])
    .filter((w) => w.status === "paid")
    .reduce((s, w) => s + Number(w.amount), 0);
  const pendingSum = ((withdrawals ?? []) as Withdrawal[])
    .filter((w) => w.status === "pending")
    .reduce((s, w) => s + Number(w.amount), 0);
  const balancesSum = ((wallets ?? []) as Wallet[]).reduce((s, w) => s + Number(w.balance), 0);

  const STAT = [
    { label: "Credited to owners (lifetime)", value: totalCredited },
    { label: "Withdrawn & paid", value: paidOut },
    { label: "Withdrawal requests pending", value: pendingSum },
    { label: "Still in wallets", value: balancesSum },
  ];
  const STATUS_STYLE: Record<string, string> = {
    pending: "border-warning/40 bg-warning/10 text-warning",
    paid: "border-success/40 bg-success/10 text-success",
    rejected: "border-danger/40 bg-danger/10 text-danger",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Wallets{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">
          What your owners have earned and drawn. Crediting and paying out is handled by the platform.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-[11px] uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mono-num mt-2 text-2xl font-semibold">
              {fmtNum(s.value)} <span className="text-xs font-normal text-muted">{currency}</span>
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Withdrawals</h2>
        <Table head={["Owner", "Amount", "Requested", "Status"]}>
          {(withdrawals ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">No withdrawal requests yet.</td>
            </tr>
          )}
          {((withdrawals ?? []) as Withdrawal[]).map((w) => (
            <tr key={w.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5">{ownerNames.get(w.owner_id) ?? "(unknown)"}</td>
              <td className="mono-num px-4 py-2.5">{fmtNum(w.amount)} {w.currency}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{w.requested_at?.slice(0, 10)}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[w.status] ?? "border-border text-muted"}`}>
                  {w.status}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Balances</h2>
        <div className="card divide-y divide-border">
          {(wallets ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No wallets yet.</p>}
          {((wallets ?? []) as Wallet[]).map((w) => (
            <div key={w.id} className="flex items-center justify-between px-5 py-3.5">
              <p className="text-sm font-medium">{ownerNames.get(w.owner_id) ?? "(unknown)"}</p>
              <p className="mono-num text-lg font-semibold">
                {fmtNum(w.balance)} <span className="text-xs text-muted">{w.currency}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

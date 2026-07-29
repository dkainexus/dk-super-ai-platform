import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { merchantTotals } from "@/modules/wallet/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { merchantFilterOptions } from "@/modules/merchants/lib";
import { fmtNum } from "@/lib/format";
import type { Owner, Wallet, Withdrawal } from "@/lib/types";

// Wallet overview: what is held, what is owed, and what each white label has
// paid out. Detail lives in the Transactions / Withdrawals / Rewards pages.
export default async function AdminWalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; merchant?: string }>;
}) {
  await requirePerm("wallet", "view");
  const { error, merchant = "" } = await searchParams;
  const { active } = await requireCountryScope();

  let ownerQuery = db().from("owners").select("id, full_name, ref, merchant_id, merchant:merchants(name)");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);
  if (merchant) ownerQuery = ownerQuery.eq("merchant_id", merchant);
  const { data: owners } = await ownerQuery;
  const ownerRows = (owners ?? []) as unknown as (Owner & { ref: string | null; merchant: { name: string } | null })[];
  const ownerIds = ownerRows.map((o) => o.id);

  const [{ data: wallets }, { data: withdrawals }, totals] = await Promise.all([
    ownerIds.length
      ? db().from("wallets").select("*").in("owner_id", ownerIds).order("balance", { ascending: false })
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? db().from("withdrawals").select("*").in("owner_id", ownerIds).eq("status", "pending")
      : Promise.resolve({ data: [] }),
    merchantTotals(active?.id ?? null),
  ]);
  const merchantOptions = await merchantFilterOptions(active?.id ?? null);

  const walletRows = (wallets ?? []) as Wallet[];
  const pending = (withdrawals ?? []) as Withdrawal[];
  const ownerById = new Map(ownerRows.map((o) => [o.id, o]));
  const currency = walletRows[0]?.currency ?? active?.currency ?? "";
  const totalBalance = walletRows.reduce((sum, w) => sum + Number(w.balance), 0);
  const pendingTotal = pending.reduce((sum, w) => sum + Number(w.amount), 0);

  const card = (label: string, value: string, sub: string, href: string, warn = false) => (
    <Link
      href={href}
      className={`card block p-5 transition-colors hover:border-accent ${warn ? "border-warning/40" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mono-num mt-1 text-2xl font-semibold ${warn ? "text-warning" : "text-accent"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Wallets</h1>
        <p className="mt-1 text-sm text-muted">
          {active ? `${active.name} — ` : ""}balances, payouts and the full history.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-4 sm:grid-cols-3">
        {card(
          "Held in wallets",
          `${fmtNum(totalBalance)} ${currency}`,
          `${walletRows.length} wallet${walletRows.length === 1 ? "" : "s"}`,
          "/admin/wallets/transactions"
        )}
        {card(
          "Awaiting payout",
          `${fmtNum(pendingTotal)} ${currency}`,
          pending.length ? `${pending.length} request(s) to process` : "All clear",
          "/admin/wallets/withdrawals",
          pending.length > 0
        )}
        {card(
          "Paid in rewards",
          `${fmtNum(totals.reduce((s, t) => s + t.credited, 0))} ${currency}`,
          "Across all white labels",
          "/admin/wallets/rewards"
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">By white label</h2>
        <Table head={["White Label", "Credited", "Withdrawn", "Still held"]}>
          {totals.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">No wallet activity yet.</td>
            </tr>
          )}
          {totals.map((t) => (
            <tr key={t.merchant_id ?? "none"} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5 font-medium">{t.name}</td>
              <td className="mono-num px-4 py-2.5 text-success">+{fmtNum(t.credited)}</td>
              <td className="mono-num px-4 py-2.5 text-danger">-{fmtNum(t.withdrawn)}</td>
              <td className="mono-num px-4 py-2.5">{fmtNum(t.balance)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <TableToolbar count={walletRows.length} noun="wallet">
          <FilterForm action="/admin/wallets">
            <FilterSelect
              label="White Label"
              name="merchant"
              value={merchant}
              options={[{ value: "", label: "All white labels" }, ...merchantOptions]}
            />
          </FilterForm>
        </TableToolbar>
        <Table head={["ID", "Owner", "White Label", "Balance"]}>
          {walletRows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">No wallets yet.</td>
            </tr>
          )}
          {walletRows.map((w) => {
            const o = ownerById.get(w.owner_id);
            return (
              <tr key={w.id} className="transition-colors hover:bg-surface-raised">
                <td className="mono-num px-4 py-2.5 text-xs text-muted">{o?.ref ?? "—"}</td>
                <td className="px-4 py-2.5">{o?.full_name ?? "(unknown)"}</td>
                <td className="px-4 py-2.5 text-muted">{o?.merchant?.name ?? "—"}</td>
                <td className="mono-num px-4 py-2.5 font-medium">
                  {fmtNum(w.balance)} {w.currency}
                </td>
              </tr>
            );
          })}
        </Table>
      </section>
    </div>
  );
}

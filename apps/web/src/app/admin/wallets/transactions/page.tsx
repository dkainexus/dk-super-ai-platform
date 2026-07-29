import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ledger } from "@/modules/wallet/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { Pagination, pageParams } from "@/components/pagination";
import { fmtNum } from "@/lib/format";
import { WALLET_TX_LABEL } from "@/lib/types";

// Every wallet movement in this country — the full history.
export default async function WalletTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; merchant?: string; page?: string; per?: string }>;
}) {
  await requirePerm("wallet", "view");
  const sp = await searchParams;
  const { type = "", merchant = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  const { data: merchantRows } = await db()
    .from("merchants")
    .select("id, name, merchant_countries(country_id)")
    .order("name");
  const merchants = ((merchantRows ?? []) as { id: string; name: string; merchant_countries: { country_id: string }[] }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ value: m.id, label: m.name }));

  const { rows, total } = await ledger({
    countryId: active?.id ?? null,
    merchantId: merchant || null,
    type: type || undefined,
    from,
    to,
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/wallets" className="text-xs text-muted hover:text-foreground">← Wallets</Link>
        <h1 className="mt-1 text-xl font-semibold">Transactions</h1>
        <p className="mt-1 text-sm text-muted">Every credit and debit, newest first.</p>
      </div>

      <TableToolbar count={total} noun="transaction">
        <FilterForm action="/admin/wallets/transactions">
          <FilterSelect
            label="White Label"
            name="merchant"
            value={merchant}
            options={[{ value: "", label: "All white labels" }, ...merchants]}
          />
          <FilterSelect
            label="Type"
            name="type"
            value={type}
            options={[
              { value: "", label: "All types" },
              ...Object.entries(WALLET_TX_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["When", "Owner", "White Label", "Type", "Note", "Amount"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted">No transactions yet.</td>
          </tr>
        )}
        {rows.map((t) => (
          <tr key={t.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 text-muted">{new Date(t.created_at).toLocaleString()}</td>
            <td className="px-4 py-2.5">
              {t.owner?.full_name ?? "—"}
              {t.owner?.ref && <span className="mono-num ml-2 text-[10px] text-muted">{t.owner.ref}</span>}
            </td>
            <td className="px-4 py-2.5 text-muted">{t.merchant?.name ?? "—"}</td>
            <td className="px-4 py-2.5 capitalize">{WALLET_TX_LABEL[t.type] ?? t.type}</td>
            <td className="px-4 py-2.5 text-muted">{t.note ?? "—"}</td>
            <td className={`mono-num px-4 py-2.5 text-right font-medium ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
              {t.amount >= 0 ? "+" : ""}
              {fmtNum(t.amount)} {t.wallet?.currency ?? ""}
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        basePath="/admin/wallets/transactions"
        params={{ type, merchant }}
        page={page}
        perPage={perPage}
        total={total}
      />
    </div>
  );
}

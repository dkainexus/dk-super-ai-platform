import Link from "next/link";
import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { customers } from "@/modules/customers/lib";
import { activeCountry } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { RowSettings } from "@/components/row-actions";
import { Table, TableToolbar } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

// The white label's own customers. Platform customers renting their accounts
// never appear here — those are ours, priced by us.
export default async function MerchantCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("customers", "view");
  const { error } = await searchParams;
  const { active } = await activeCountry(cu);

  const rows = (
    await customers({ countryId: active?.id, merchantId: cu.merchant.id, belongsTo: "white_label" })
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">Your customers — you set their terms and carry their losses.</p>
        </div>
        {can(cu, "customers", "add") && (
          <Link
            href="/m/customers/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Customer
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="customer" />

      <Table head={["ID", "Name", "Company", "Deposit", "Contracts", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">No customers yet — use the button above to add one.</td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{c.name}</td>
            <td className="px-4 py-2.5 text-muted">{c.company_name ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(c.deposit)}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{c.contracts?.[0]?.count ?? 0}</td>
            <td className="px-4 py-2.5">
              <ActiveTag active={c.status === "active"} on="Active" off="Suspended" />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/m/customers/${c.id}`} tip={`Open ${c.name}`} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

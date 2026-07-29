import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { customers } from "@/modules/customers/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { merchantFilterOptions } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { fmtNum } from "@/lib/format";

// The renting side: every customer, what they rent and what they owe.
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; merchant?: string; status?: string; belongs?: string }>;
}) {
  const { cu } = await requirePerm("customers", "view");
  const { error, merchant = "", status = "", belongs = "" } = await searchParams;
  const { active } = await requireCountryScope();

  const [rows, merchants] = await Promise.all([
    customers({ countryId: active?.id, merchantId: merchant, status, belongsTo: belongs }),
    merchantFilterOptions(active?.id ?? null),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted">
            {active ? `${active.name} only.` : "All countries."} Who each customer belongs to decides who carries
            their losses.
          </p>
        </div>
        {can(cu, "customers", "add") && (
          <Link
            href="/admin/customers/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Customer
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="customer">
        <FilterForm action="/admin/customers">
          <FilterSelect
            label="White Label"
            name="merchant"
            value={merchant}
            options={[{ value: "", label: "All white labels" }, ...merchants]}
          />
          <FilterSelect
            label="Belongs To"
            name="belongs"
            value={belongs}
            options={[
              { value: "", label: "Everyone" },
              { value: "platform", label: "Ours" },
              { value: "white_label", label: "White label's" },
            ]}
          />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Name", "Company", "White Label", "Belongs To", "Deposit", "Contracts", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-sm text-muted">No customers match these filters.</td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{c.name}</td>
            <td className="px-4 py-2.5 text-muted">{c.company_name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{c.merchant?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{c.belongs_to === "platform" ? "Ours" : "White label"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(c.deposit)}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{c.contracts?.[0]?.count ?? 0}</td>
            <td className="px-4 py-2.5">
              <ActiveTag active={c.status === "active"} on="Active" off="Suspended" />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/customers/${c.id}`} tip={`Open ${c.name}`} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

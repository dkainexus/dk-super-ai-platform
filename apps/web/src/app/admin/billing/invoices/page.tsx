import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { INVOICE_SELECT, partyLabel, type InvoiceRow } from "@/modules/billing/lib";
import { ErrorBanner } from "@/components/error-banner";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { Pagination, pageParams } from "@/components/pagination";
import { fmtNum } from "@/lib/format";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; party?: string; status?: string; page?: string; per?: string }>;
}) {
  await requirePerm("billing", "view");
  const sp = await searchParams;
  const { error, party = "", status = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  let q = db()
    .from("invoices")
    .select(INVOICE_SELECT, { count: "exact" })
    .neq("status", "draft")
    .order("period_month", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (active) q = q.eq("country_id", active.id);
  if (party) q = q.eq("party_type", party);
  if (status) q = q.eq("status", status);
  const { data, count } = await q;
  const rows = (data ?? []) as unknown as InvoiceRow[];
  const total = count ?? rows.length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/billing" className="text-xs text-muted hover:text-foreground">← Billing</Link>
        <h1 className="mt-1 text-xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">Everything issued, newest first. Drafts live on the run page.</p>
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={total} noun="invoice">
        <FilterForm action="/admin/billing/invoices">
          <FilterSelect
            label="Party"
            name="party"
            value={party}
            options={[
              { value: "", label: "Everyone" },
              { value: "customer", label: "Customers" },
              { value: "agent", label: "Agents" },
              { value: "owner", label: "Owners" },
            ]}
          />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "issued", label: "Issued" },
              { value: "paid", label: "Paid" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Who", "Kind", "Month", "Direction", "Total", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">No invoices match these filters.</td>
          </tr>
        )}
        {rows.map((inv) => (
          <tr key={inv.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{inv.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{partyLabel(inv)}</td>
            <td className="px-4 py-2.5 capitalize text-muted">{inv.party_type}</td>
            <td className="px-4 py-2.5 text-muted">{inv.period_month.slice(0, 7)}</td>
            <td className="px-4 py-2.5 text-muted">{inv.direction === "receivable" ? "they pay" : "we pay"}</td>
            <td className="mono-num px-4 py-2.5">{fmtNum(inv.total)} {inv.currency}</td>
            <td className="px-4 py-2.5 capitalize text-muted">{inv.status}</td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/billing/invoices/${inv.id}`} tip="Open this invoice" />
            </td>
          </tr>
        ))}
      </Table>

      <Pagination basePath="/admin/billing/invoices" params={{ party, status }} page={page} perPage={perPage} total={total} />
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { type InvoiceRow } from "@/modules/billing/lib";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  issued: "border-warning/40 bg-warning/10 text-warning",
  paid: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};

// What the customer owes and has paid — each invoice with its full working.
export default async function PortalInvoicesPage() {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;

  const { data } = await db()
    .from("invoices")
    .select("*, invoice_lines(*)")
    .eq("customer_id", c.id)
    .neq("status", "draft")
    .order("period_month", { ascending: false });
  const rows = (data ?? []) as unknown as InvoiceRow[];
  const owed = rows.filter((r) => r.status === "issued").reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">
          {owed > 0
            ? `Outstanding: ${fmtNum(owed)} ${rows[0]?.currency ?? ""}`
            : "Nothing outstanding."}
        </p>
      </div>

      {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing billed yet.</p>}

      {rows.map((inv) => (
        <section key={inv.id} className="card p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">
              <span className="mono-num">{inv.ref ?? "Invoice"}</span>
              <span className="ml-2 font-normal text-muted">{inv.period_month.slice(0, 7)}</span>
            </p>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[inv.status] ?? ""}`}>
              {inv.status}
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

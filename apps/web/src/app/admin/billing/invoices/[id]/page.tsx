import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { INVOICE_SELECT, partyLabel, type InvoiceRow } from "@/modules/billing/lib";
import { markInvoicePaid, cancelInvoice } from "@/modules/billing/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  draft: "border-border text-muted",
  issued: "border-warning/40 bg-warning/10 text-warning",
  paid: "border-success/40 bg-success/10 text-success",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
};

// The stored snapshot: every number as it was the day the invoice was raised.
export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("billing", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db().from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as unknown as InvoiceRow;
  const canEdit = Boolean(can(cu, "billing", "edit"));
  const back = `/admin/billing/invoices/${inv.id}`;
  const lines = [...inv.invoice_lines].sort((a, b) => (a.period_start ?? "") < (b.period_start ?? "") ? -1 : 1);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/billing/invoices" className="text-xs text-muted hover:text-foreground">← Invoices</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{inv.ref ?? "Draft invoice"}</h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[inv.status]}`}>
            {inv.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {partyLabel(inv)} · {inv.merchant?.name ?? "—"} · {inv.period_month.slice(0, 7)} ·{" "}
          {inv.direction === "receivable" ? "they pay us" : "we pay them"}
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Line</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Working</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="mono-num px-4 py-2.5 text-xs text-muted">
                  {l.days != null && l.days_in_month != null && l.days < l.days_in_month
                    ? `${fmtNum(Number(l.snapshot?.base_rent ?? 0))} × ${l.days}/${l.days_in_month}`
                    : l.kind === "setup_fee"
                      ? "one-off"
                      : "full month"}
                </td>
                <td className="mono-num px-4 py-2.5 text-right">{fmtNum(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-4 py-3 font-semibold" colSpan={2}>Total</td>
              <td className="mono-num px-4 py-3 text-right text-base font-semibold">
                {fmtNum(inv.total)} {inv.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="text-xs text-muted">
        {inv.issued_at && `Issued ${new Date(inv.issued_at).toLocaleString()}`}
        {inv.paid_at && ` · paid ${new Date(inv.paid_at).toLocaleString()}`}
      </p>

      {canEdit && inv.status === "issued" && (
        <div className="flex flex-wrap gap-2">
          <form action={markInvoicePaid}>
            <input type="hidden" name="id" value={inv.id} />
            <input type="hidden" name="back" value={back} />
            <ActionButton
              icon="check"
              tip={inv.direction === "receivable" ? "The customer has paid" : "We have paid this out"}
              label="Mark Paid"
              variant="success"
            />
          </form>
          <form action={cancelInvoice}>
            <input type="hidden" name="id" value={inv.id} />
            <input type="hidden" name="back" value={back} />
            <ActionButton
              icon="x"
              tip="Cancel — fix the terms, then Recalculate the month to raise the replacement"
              label="Cancel & Reissue"
              variant="danger"
            />
          </form>
        </div>
      )}
    </div>
  );
}

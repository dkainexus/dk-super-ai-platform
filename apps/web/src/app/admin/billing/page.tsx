import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { runForMonth, partyLabel } from "@/modules/billing/lib";
import { generateDraft, discardDraft, approveAndIssue } from "@/modules/billing/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { RowSettings } from "@/components/row-actions";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

// The monthly run: draft first, read it, then Approve & Issue. Repeating a run
// can only add what is missing — a line already issued is never raised twice.
export default async function BillingRunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; month?: string; issued?: string }>;
}) {
  const { cu } = await requirePerm("billing", "view");
  const sp = await searchParams;
  const { error, issued } = sp;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : new Date().toISOString().slice(0, 7);
  const summary = await runForMonth(active.id, `${month}-01`);
  const canRun = Boolean(can(cu, "billing", "add"));
  const canIssue = Boolean(can(cu, "billing", "edit"));
  const back = `/admin/billing?month=${month}`;

  const receivable = summary?.invoices.filter((i) => i.direction === "receivable") ?? [];
  const payable = summary?.invoices.filter((i) => i.direction === "payable") ?? [];
  const sum = (rows: typeof receivable) => rows.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Monthly Run — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Base rent in advance, part-months prorated, setup fees on the first invoice. Nothing reaches anyone
          until the draft is approved.
        </p>
      </div>
      <ErrorBanner message={error} />
      {issued && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          {issued} invoice{issued === "1" ? "" : "s"} issued.
        </p>
      )}

      <section className="card flex flex-wrap items-end gap-3 p-5">
        <form action={generateDraft} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Month</label>
            <input name="month" type="month" defaultValue={month} className="input mono-num" />
          </div>
          {canRun && (
            <ActionButton
              icon="check"
              tip="Build (or rebuild) the draft for this month — nothing is sent yet"
              label={summary?.run.status === "draft" ? "Recalculate" : "Generate Draft"}
              variant="primary"
            />
          )}
        </form>
        {summary?.run.status === "draft" && canIssue && (
          <>
            <form action={approveAndIssue}>
              <input type="hidden" name="run_id" value={summary.run.id} />
              <input type="hidden" name="back" value={back} />
              <ActionButton
                icon="send"
                tip="The point of no return: every draft below becomes a real invoice or payout"
                label="Approve & Issue"
                variant="success"
              />
            </form>
            <form action={discardDraft}>
              <input type="hidden" name="run_id" value={summary.run.id} />
              <input type="hidden" name="back" value={back} />
              <ActionButton icon="trash" tip="Throw this draft away" label="Discard Draft" variant="danger" />
            </form>
          </>
        )}
        <Link
          href="/admin/billing/invoices"
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          All Invoices →
        </Link>
      </section>

      {!summary && (
        <p className="card px-5 py-6 text-sm text-muted">
          No run for {month} yet{canRun ? " — generate the draft above." : "."}
        </p>
      )}

      {summary && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
                summary.run.status === "draft"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-success/40 bg-success/10 text-success"
              }`}
            >
              {summary.run.status}
            </span>
            {summary.warnings.map((w) => (
              <span key={w} className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning">
                {w}
              </span>
            ))}
          </div>

          {(
            [
              ["Customers pay us", receivable],
              ["We pay owners and agents", payable],
            ] as const
          ).map(([title, rows]) => (
            <section key={title} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
                <p className="mono-num text-sm font-semibold">
                  {fmtNum(sum(rows))} {rows[0]?.currency ?? active.currency}
                </p>
              </div>
              <Table head={["ID", "Who", "Kind", "Lines", "Total", "Status", ""]}>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-sm text-muted">Nothing this month.</td>
                  </tr>
                )}
                {rows.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-surface-raised">
                    <td className="mono-num px-4 py-2.5 text-xs text-muted">{inv.ref ?? "draft"}</td>
                    <td className="px-4 py-2.5 font-medium">{partyLabel(inv)}</td>
                    <td className="px-4 py-2.5 capitalize text-muted">{inv.party_type}</td>
                    <td className="mono-num px-4 py-2.5 text-muted">{inv.invoice_lines.length}</td>
                    <td className="mono-num px-4 py-2.5">{fmtNum(inv.total)} {inv.currency}</td>
                    <td className="px-4 py-2.5 capitalize text-muted">{inv.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      <RowSettings href={`/admin/billing/invoices/${inv.id}`} tip="Open this invoice" />
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

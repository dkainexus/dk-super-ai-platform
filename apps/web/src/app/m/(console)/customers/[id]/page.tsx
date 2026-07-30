import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMerchantUser, requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customer } from "@/modules/customers/lib";
import {
  updateCustomer,
  issueCustomerLogin,
  setCustomerStatus,
  deleteCustomer,
} from "@/modules/customers/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

// A white label's view of their own customer: details, the portal sign-in,
// and what has been billed — the contracts themselves are managed by us.
export default async function MerchantCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("customers", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const c = await customer(id);
  // Only their own customers — a platform customer's page does not exist here.
  if (!c || c.merchant_id !== cu.merchant.id || c.belongs_to !== "white_label") notFound();

  const [{ data: theirContracts }, { data: invoices }] = await Promise.all([
    db()
      .from("contracts")
      .select("id, ref, starts_on, ends_on, status, contract_accounts(count)")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false }),
    db()
      .from("invoices")
      .select("id, ref, period_month, total, currency, status")
      .eq("customer_id", c.id)
      .neq("status", "draft")
      .order("period_month", { ascending: false })
      .limit(12),
  ]);

  const canEdit = Boolean(can(cu, "customers", "edit"));
  const { ledgerFor } = await import("@/modules/billing/ledger");
  const wallet = await ledgerFor("customer", c.id);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/m/customers" className="text-xs text-muted hover:text-foreground">← Customers</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{c.name}</h1>
          <ActiveTag active={c.status === "active"} on="Active" off="Suspended" />
          {c.ref && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{c.ref}</span>
          )}
        </div>
      </div>
      <ErrorBanner message={error} />
      {saved === "login" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sign-in created — username <span className="mono-num">{c.user?.username}</span>, starter password{" "}
          <span className="mono-num">123456</span>, changed at first sign-in.
        </p>
      )}
      {saved === "reset" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Password reset to <span className="mono-num">123456</span> — changed at next sign-in.
        </p>
      )}

      <section className="card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
        <form action={updateCustomer} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={c.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">Customer Name</label>
            <input name="name" defaultValue={c.name} className="input" disabled={!canEdit} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Company Name</label>
            <input name="company_name" defaultValue={c.company_name ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Contact Person</label>
            <input name="contact_name" defaultValue={c.contact_name ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input name="email" type="email" defaultValue={c.email ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Deposit (written, not collected)</label>
            <MoneyInput name="deposit" defaultValue={c.deposit} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea name="notes" defaultValue={c.notes ?? ""} rows={2} className="input" disabled={!canEdit} />
          </div>
          {canEdit && (
            <div className="sm:col-span-2">
              <SaveButton tip="Save customer details" />
            </div>
          )}
        </form>
      </section>

      {canEdit && (
        <section className="card p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Portal Sign-in</h2>
          <p className="mb-4 text-xs text-muted">
            {c.user
              ? `Signs in as ${c.user.username}. The portal shows them their accounts, contracts and invoices.`
              : "No sign-in yet — issuing one uses the reference as the username and 123456 as the starter password."}
          </p>
          <form action={issueCustomerLogin} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={c.id} />
            <ActionButton
              icon="key"
              tip={c.user ? "Reset the password to 123456" : "Create the portal sign-in"}
              label={c.user ? "Reset to 123456" : "Issue Sign-in"}
              variant="primary"
            />
          </form>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Wallet</h2>
          <p className="mono-num text-lg font-semibold">
            {fmtNum(wallet.balance)} {wallet.currency ?? ""}
          </p>
        </div>
        <div className="divide-y divide-border">
          {wallet.entries.length === 0 && <p className="py-3 text-sm text-muted">No wallet activity yet.</p>}
          {wallet.entries.slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-muted">
                {e.kind === "topup" ? "Top-up" : e.kind === "invoice_payment" ? `Paid ${e.note ?? "invoice"}` : e.note ?? e.kind}
              </span>
              <span className={`mono-num ${Number(e.amount) >= 0 ? "text-success" : "text-danger"}`}>
                {Number(e.amount) >= 0 ? "+" : ""}
                {fmtNum(e.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Contracts</h2>
        <Table head={["ID", "Term", "Accounts", "Status"]}>
          {(theirContracts ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">No contracts yet — contact us to set one up.</td>
            </tr>
          )}
          {((theirContracts ?? []) as {
            id: string; ref: string | null; starts_on: string | null; ends_on: string | null; status: string;
            contract_accounts: { count: number }[];
          }[]).map((k) => (
            <tr key={k.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{k.ref ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">
                {k.starts_on ? `${k.starts_on} → ${k.ends_on ?? "…"}` : "not activated"}
              </td>
              <td className="mono-num px-4 py-2.5 text-muted">{k.contract_accounts?.[0]?.count ?? 0}</td>
              <td className="px-4 py-2.5 capitalize text-muted">{k.status}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Recent Invoices</h2>
        <Table head={["ID", "Month", "Total", "Status"]}>
          {(invoices ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">Nothing billed yet.</td>
            </tr>
          )}
          {((invoices ?? []) as { id: string; ref: string | null; period_month: string; total: number; currency: string; status: string }[]).map(
            (inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-surface-raised">
                <td className="mono-num px-4 py-2.5 text-xs text-muted">{inv.ref ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{inv.period_month.slice(0, 7)}</td>
                <td className="mono-num px-4 py-2.5">{fmtNum(inv.total)} {inv.currency}</td>
                <td className="px-4 py-2.5 capitalize text-muted">{inv.status}</td>
              </tr>
            )
          )}
        </Table>
      </section>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={setCustomerStatus}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} />
            <ActionButton
              icon="power"
              tip={c.status === "active" ? "Suspend — the customer can no longer sign in" : "Let this customer sign in again"}
              label={c.status === "active" ? "Suspend" : "Reactivate"}
            />
          </form>
          {can(cu, "customers", "delete") && (
            <form action={deleteCustomer} className="ml-auto">
              <input type="hidden" name="id" value={c.id} />
              <ActionButton icon="trash" tip="Delete this customer (blocked once they have contracts)" variant="danger" />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

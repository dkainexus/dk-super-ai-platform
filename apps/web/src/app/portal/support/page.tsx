import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { ticketTypesFor } from "@/modules/tickets/lib";
import { submitTicket } from "@/app/portal/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";

// Report a problem, and see everything reported before.
export default async function PortalSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error } = await searchParams;

  const [{ data: lines }, types, { data: ticketRows }] = await Promise.all([
    db()
      .from("contract_accounts")
      .select("bank_account_id, contract:contracts!inner(customer_id, status), bank_account:bank_accounts(account_no, bank:banks(name))")
      .eq("contract.customer_id", c.id)
      .neq("contract.status", "draft"),
    c.country_id ? ticketTypesFor(c.country_id, c.merchant_id) : Promise.resolve([]),
    db()
      .from("tickets")
      .select("id, ref, status, description, created_at, bank_account:bank_accounts(account_no, bank:banks(name)), type:ticket_types(name)")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false }),
  ]);

  const seen = new Set<string>();
  const accounts = ((lines ?? []) as unknown as {
    bank_account_id: string;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
  }[]).filter((a) => (seen.has(a.bank_account_id) ? false : (seen.add(a.bank_account_id), true)));

  const rows = (ticketRows ?? []) as unknown as {
    id: string;
    ref: string | null;
    status: string;
    description: string;
    created_at: string;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
    type: { name: string } | null;
  }[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-muted">
          Something wrong with an account? Tell us the balance and the last transaction as they are right now —
          it decides how the problem is handled.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Report a Problem</h2>
        <form action={submitTicket} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Account *</label>
            <select name="bank_account_id" className="input" required>
              <option value="">— Select the account —</option>
              {accounts.map((a) => (
                <option key={a.bank_account_id} value={a.bank_account_id}>
                  {a.bank_account?.bank?.name ?? "?"} {a.bank_account?.account_no}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Problem Type</label>
            <select name="type_id" className="input">
              <option value="">— Not sure —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">What happened *</label>
            <textarea name="description" rows={3} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Current Balance *</label>
            <MoneyInput name="reported_balance" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Last Transaction (date & amount) *</label>
            <input name="last_transaction" className="input" placeholder="e.g. 2026-07-29 · out 45,000" required />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Screenshot</label>
            <input name="screenshot" type="file" accept="image/*,.pdf" className="input" />
          </div>
          <div className="sm:col-span-2">
            <ActionButton icon="send" tip="Report this problem" label="Submit" variant="primary" />
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Your tickets</h2>
        {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing reported yet.</p>}
        {rows.map((t) => (
          <Link
            key={t.id}
            href={`/portal/support/${t.id}`}
            className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-accent"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {t.type?.name ?? "Problem"} — {t.bank_account?.bank?.name ?? "?"} {t.bank_account?.account_no}
              </p>
              <p className="truncate text-xs text-muted">{t.description}</p>
            </div>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
              {t.status}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

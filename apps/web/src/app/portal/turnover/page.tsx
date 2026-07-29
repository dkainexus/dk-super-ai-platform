import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { firstOfMonth, addMonths } from "@/modules/billing/engine";
import { submitTurnover } from "@/app/portal/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { fmtNum } from "@/lib/format";

type Decl = { period_month: string; amount: number; status: string; reject_reason: string | null };

// From the 1st, each account asks for last month's turnover and its statement.
export default async function PortalTurnoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error, saved } = await searchParams;

  const { data: lines } = await db()
    .from("contract_accounts")
    .select(
      "id, starts_on, ends_on, bank_account_id, contract:contracts!inner(customer_id, status), bank_account:bank_accounts(account_no, bank:banks(name))"
    )
    .eq("contract.customer_id", c.id)
    .neq("contract.status", "draft");
  const accounts = (lines ?? []) as unknown as {
    id: string;
    starts_on: string | null;
    ends_on: string | null;
    bank_account_id: string;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
  }[];

  const { data: declRows } = await db()
    .from("turnover_declarations")
    .select("bank_account_id, period_month, amount, status, reject_reason")
    .eq("customer_id", c.id);
  const decls = new Map<string, Decl>();
  for (const d of (declRows ?? []) as (Decl & { bank_account_id: string })[]) {
    decls.set(`${d.bank_account_id}|${d.period_month}`, d);
  }

  // The months owed: from each account's start month up to last month.
  const thisMonth = firstOfMonth(new Date().toISOString().slice(0, 10));
  const rows: { account: (typeof accounts)[0]; month: string; decl: Decl | null }[] = [];
  for (const a of accounts) {
    if (!a.starts_on) continue;
    let m = firstOfMonth(a.starts_on);
    for (let i = 0; i < 12 && m < thisMonth; i++) {
      if (!a.ends_on || m <= a.ends_on) {
        rows.push({ account: a, month: m, decl: decls.get(`${a.bank_account_id}|${m}`) ?? null });
      }
      m = addMonths(m, 1);
    }
  }
  rows.sort((x, y) => (x.month < y.month ? 1 : -1));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Monthly Turnover</h1>
        <p className="mt-1 text-sm text-muted">
          Each month, enter every account&apos;s turnover and attach its bank statement. Once we approve it, any
          turnover charge appears on the next invoice.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Submitted — we will review it against the statement.
        </p>
      )}

      {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing to declare yet.</p>}

      {rows.map(({ account, month, decl }) => (
        <section key={`${account.id}|${month}`} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {account.bank_account?.bank?.name ?? "?"}{" "}
              <span className="mono-num font-normal text-muted">{account.bank_account?.account_no}</span>
              <span className="ml-2 font-normal text-muted">· {month.slice(0, 7)}</span>
            </p>
            {decl && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
                  decl.status === "approved"
                    ? "border-success/40 bg-success/10 text-success"
                    : decl.status === "rejected"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                {decl.status}
              </span>
            )}
          </div>

          {decl && decl.status !== "rejected" ? (
            <p className="mono-num text-sm text-muted">Declared {fmtNum(decl.amount)}</p>
          ) : (
            <>
              {decl?.reject_reason && (
                <p className="text-xs text-danger">Rejected: {decl.reject_reason} — please resubmit.</p>
              )}
              <form action={submitTurnover} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="bank_account_id" value={account.bank_account_id} />
                <input type="hidden" name="period_month" value={month} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Turnover for {month.slice(0, 7)}</label>
                  <MoneyInput name="amount" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Bank statement (PDF or image)</label>
                  <input name="statement" type="file" accept="image/*,.pdf" className="input" required />
                </div>
                <ActionButton icon="send" tip="Submit this month for review" label="Submit" variant="primary" />
              </form>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

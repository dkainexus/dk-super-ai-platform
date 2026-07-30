import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { claims } from "@/modules/claims/lib";
import { createClaim } from "@/modules/claims/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  open: "border-warning/40 bg-warning/10 text-warning",
  confirmed: "border-accent/40 bg-accent-soft text-accent-strong",
  closed: "border-border text-muted",
};

// Money stolen from a rented account. Recording it computes who owes whom;
// nothing moves until the computation is confirmed.
export default async function CompensationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("claims", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  const [rows, { data: accounts }] = await Promise.all([
    claims(active?.id),
    db()
      .from("bank_accounts")
      .select("id, ref, account_no, bank:banks(name)")
      .eq("country_id", active?.id ?? "")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Compensation</h1>
        <p className="mt-1 text-sm text-muted">
          Compensation is capped at each party&apos;s own written insurance; the shortfall is written off. The
          owner&apos;s rent is never touched.
        </p>
      </div>
      <ErrorBanner message={error} />

      {can(cu, "claims", "add") && (
        <form action={createClaim} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_1fr_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">Account</label>
            <select name="bank_account_id" className="input" required>
              <option value="">— Which account was robbed —</option>
              {((accounts ?? []) as unknown as { id: string; ref: string | null; account_no: string; bank: { name: string } | null }[]).map(
                (a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank?.name ?? "?"} {a.account_no}
                    {a.ref ? ` · ${a.ref}` : ""}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Amount Taken</label>
            <MoneyInput name="amount" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">What Happened</label>
            <input name="description" className="input" />
          </div>
          <ActionButton icon="plus" tip="Record the theft and compute the compensation" label="Record Theft" variant="danger" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="case" />
      <Table head={["ID", "Account", "Company", "Stolen", "Customer Gets", "Agent Owes", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">No thefts on record.</td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
            <td className="px-4 py-2.5">
              {c.bank_account?.bank?.name ?? "?"}{" "}
              <span className="mono-num text-xs text-muted">{c.bank_account?.account_no}</span>
            </td>
            <td className="px-4 py-2.5 text-muted">{c.bank_account?.company?.name ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-danger">{fmtNum(c.amount)}</td>
            <td className="mono-num px-4 py-2.5">{c.customer_compensation != null ? fmtNum(c.customer_compensation) : "—"}</td>
            <td className="mono-num px-4 py-2.5">{c.agent_recovery != null ? fmtNum(c.agent_recovery) : "—"}</td>
            <td className="px-4 py-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[c.status]}`}>
                {c.status}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/compensation/${c.id}`} tip="Open this case" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

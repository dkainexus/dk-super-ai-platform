import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  contract,
  contractAccounts,
  currentTerms,
  partyName,
  renewalState,
  today,
} from "@/modules/contracts/lib";
import {
  updateContract,
  activateContract,
  addContractAccount,
  changeTerms,
  startAccountEarly,
  endContractAccount,
  removeContractAccount,
  renewContract,
  terminateContract,
  deleteContract,
} from "@/modules/contracts/actions";
import { addDays } from "@/modules/billing/engine";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { RowSettings } from "@/components/row-actions";
import { Table } from "@/components/data-table";
import { AuditLine } from "@/components/audit-line";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  draft: "border-border text-muted",
  active: "border-success/40 bg-success/10 text-success",
  expired: "border-warning/40 bg-warning/10 text-warning",
  terminated: "border-danger/40 bg-danger/10 text-danger",
};

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const c = await contract(id);
  if (!c) notFound();

  const [lines, { data: invoices }, { data: freeAccounts }] = await Promise.all([
    contractAccounts(c.id),
    db()
      .from("invoices")
      .select("id, ref, period_month, total, currency, status, direction")
      .or(
        c.party_type === "customer"
          ? `customer_id.eq.${c.customer_id}`
          : c.party_type === "agent"
            ? `agent_id.eq.${c.agent_id}`
            : `owner_id.eq.${c.owner_id}`
      )
      .neq("status", "draft")
      .order("period_month", { ascending: false })
      .limit(12),
    db()
      .from("bank_accounts")
      .select("id, ref, account_no, bank:banks(name, code)")
      .eq("merchant_id", c.merchant_id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  const onLines = new Set(lines.map((l) => l.bank_account_id));
  const addable = ((freeAccounts ?? []) as unknown as {
    id: string;
    ref: string | null;
    account_no: string;
    bank: { name: string; code: string | null } | null;
  }[]).filter((a) => !onLines.has(a.id));

  const day = today();
  const renewal = renewalState(c, day);
  const isExpired = c.status === "active" && c.ends_on !== null && c.ends_on < day;
  const canEdit = Boolean(can(cu, "contracts", "edit"));
  const defaultStart = addDays(day, c.lead_days);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{partyName(c)}</h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[isExpired ? "expired" : c.status]}`}>
            {isExpired ? "expired" : c.status}
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
            {c.party_type}
          </span>
          {c.ref && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{c.ref}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {c.merchant?.name ?? "—"}
          {c.starts_on ? ` · term ${c.starts_on} → ${c.ends_on ?? "…"}` : " · not activated yet"}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "active" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Contract activated — the term is fixed from the earliest account start.
        </p>
      )}
      {saved === "renewed" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Renewed — the new end date is {c.ends_on}.
        </p>
      )}
      {saved === "terms" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          New terms saved — they take effect from the 1st of next month; this month stays on the old price.
        </p>
      )}

      {/* ---------- header terms ---------- */}
      <section className="card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Terms</h2>
        <form action={updateContract} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="id" value={c.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">Minimum Term (months)</label>
            <input
              name="min_term_months"
              type="number"
              min={1}
              defaultValue={c.min_term_months}
              className="input mono-num"
              disabled={!canEdit || c.status !== "draft"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Renewal Minimum (months)</label>
            <input name="renewal_min_months" type="number" min={1} defaultValue={c.renewal_min_months} className="input mono-num" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Renewal Window (days)</label>
            <input name="renewal_window_days" type="number" min={1} defaultValue={c.renewal_window_days} className="input mono-num" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Lead Days</label>
            <input name="lead_days" type="number" min={0} defaultValue={c.lead_days} className="input mono-num" disabled={!canEdit} />
          </div>
          {c.party_type !== "owner" && (
            <div>
              <label className="mb-1 block text-xs text-muted">Insurance (written, not collected)</label>
              <MoneyInput name="deposit" defaultValue={c.deposit} />
            </div>
          )}
          {c.party_type === "agent" && (
            <div>
              <label className="mb-1 block text-xs text-muted">Theft Liability Window (months)</label>
              <input name="theft_window_months" type="number" min={0} defaultValue={c.theft_window_months ?? 6} className="input mono-num" disabled={!canEdit} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea name="notes" defaultValue={c.notes ?? ""} rows={2} className="input" disabled={!canEdit} />
          </div>
          {canEdit && (
            <div className="sm:col-span-full">
              <SaveButton tip="Save the contract terms" />
            </div>
          )}
        </form>
      </section>

      {/* ---------- accounts ---------- */}
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Accounts on this contract</h2>
          <p className="mt-1 text-xs text-muted">
            Each account carries its own rent. Changing terms takes effect from the 1st of next month — history is
            kept, and old invoices never move.
          </p>
        </div>

        {lines.length === 0 && <p className="text-sm text-muted">No accounts yet — add the first one below.</p>}

        {lines.map((l) => {
          const t = currentTerms(l.contract_terms, day);
          const history = [...l.contract_terms].sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
          return (
            <div key={l.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {l.bank_account?.bank?.name ?? "?"}{" "}
                  <span className="mono-num font-normal text-muted">{l.bank_account?.account_no}</span>
                  {l.bank_account?.ref && (
                    <span className="mono-num ml-2 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-muted">
                      {l.bank_account.ref}
                    </span>
                  )}
                </p>
                <p className="mono-num text-xs text-muted">
                  bills from {l.starts_on ?? "—"}
                  {l.ends_on ? ` until ${l.ends_on}` : ""}
                </p>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Base Rent / month</p>
                  <p className="mono-num">{t ? fmtNum(t.base_rent) : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Turnover %</p>
                  <p className="mono-num">{t?.turnover_rate != null ? `${t.turnover_rate}%` : "none"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Setup Fee</p>
                  <p className="mono-num">
                    {fmtNum(l.setup_fee)}
                    {l.setup_fee_invoiced_at ? " · billed" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Terms versions</p>
                  <p className="mono-num">{l.contract_terms.length}</p>
                </div>
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-end gap-4 border-t border-border pt-3">
                  {/* New terms from next month */}
                  <form action={changeTerms} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="contract_id" value={c.id} />
                    <input type="hidden" name="contract_account_id" value={l.id} />
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">New base rent</label>
                      <MoneyInput name="base_rent" defaultValue={t?.base_rent ?? 0} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">New turnover %</label>
                      <input
                        name="turnover_rate"
                        defaultValue={t?.turnover_rate ?? ""}
                        placeholder="none"
                        className="input w-24 mono-num"
                      />
                    </div>
                    <ActionButton icon="check" tip="Save — takes effect from the 1st of next month" label="Change Terms" />
                  </form>

                  {/* Start early, until it has been billed */}
                  {!l.setup_fee_invoiced_at && (
                    <form action={startAccountEarly} className="flex items-end gap-2">
                      <input type="hidden" name="contract_id" value={c.id} />
                      <input type="hidden" name="contract_account_id" value={l.id} />
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Billing starts</label>
                        <input name="starts_on" type="date" defaultValue={l.starts_on ?? ""} className="input mono-num" />
                      </div>
                      <ActionButton icon="check" tip="The customer confirmed early — move the start" label="Start Early" />
                    </form>
                  )}

                  {/* End or remove */}
                  <form action={endContractAccount} className="flex items-end gap-2">
                    <input type="hidden" name="contract_id" value={c.id} />
                    <input type="hidden" name="contract_account_id" value={l.id} />
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Ends on</label>
                      <input name="ends_on" type="date" defaultValue={l.ends_on ?? ""} className="input mono-num" />
                    </div>
                    <ActionButton icon="power" tip="The account leaves the contract on this day; the last month prorates" label="End" />
                  </form>
                  <form action={removeContractAccount} className="ml-auto">
                    <input type="hidden" name="contract_id" value={c.id} />
                    <input type="hidden" name="contract_account_id" value={l.id} />
                    <ActionButton icon="trash" tip="Remove (only while nothing has been billed)" variant="danger" />
                  </form>
                </div>
              )}

              {history.length > 1 && (
                <details className="border-t border-border pt-2">
                  <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                    Terms history
                  </summary>
                  <div className="mt-2 space-y-1">
                    {history.map((h) => (
                      <p key={h.id} className="mono-num text-xs text-muted">
                        {h.effective_from} → {h.effective_to ?? "…"} · base {fmtNum(h.base_rent)}
                        {h.turnover_rate != null ? ` · ${h.turnover_rate}%` : ""}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}

        {canEdit && c.status !== "terminated" && (
          <form action={addContractAccount} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <input type="hidden" name="contract_id" value={c.id} />
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-muted">Add Account</label>
              <select name="bank_account_id" className="input" required>
                <option value="">— Select an account —</option>
                {addable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank?.name ?? "?"} {a.account_no}
                    {a.ref ? ` · ${a.ref}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Base Rent / month</label>
              <MoneyInput name="base_rent" defaultValue={0} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Turnover % (blank = none)</label>
              <input name="turnover_rate" placeholder="e.g. 0.30" className="input mono-num" />
            </div>
            {c.party_type === "customer" && (
              <div>
                <label className="mb-1 block text-xs text-muted">Setup Fee</label>
                <MoneyInput name="setup_fee" defaultValue={0} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted">Billing starts</label>
              <input name="starts_on" type="date" defaultValue={defaultStart} className="input mono-num" />
            </div>
            <div>
              <ActionButton icon="plus" tip="Add this account with these terms" label="Add" variant="primary" />
            </div>
          </form>
        )}
      </section>

      {/* ---------- lifecycle ---------- */}
      {canEdit && (
        <section className="card flex flex-wrap items-end gap-4 p-5">
          {c.status === "draft" && (
            <form action={activateContract}>
              <input type="hidden" name="id" value={c.id} />
              <ActionButton
                icon="check"
                tip="Fix the term from the earliest account start and make the contract live"
                label="Activate"
                variant="success"
              />
            </form>
          )}
          {c.status === "active" && (renewal === "open" || renewal === "closed") && (
            <form action={renewContract} className="flex items-end gap-2">
              <input type="hidden" name="id" value={c.id} />
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                  Renew for (min {c.renewal_min_months} months)
                </label>
                <input name="months" type="number" min={c.renewal_min_months} defaultValue={c.renewal_min_months} className="input w-24 mono-num" />
              </div>
              <ActionButton
                icon="check"
                tip={
                  renewal === "open"
                    ? "Extend the contract from its current end date"
                    : "The window has closed — renewing now is by agreement, admin only"
                }
                label={renewal === "open" ? "Renew" : "Admin Renew"}
                variant={renewal === "open" ? "primary" : "outline"}
              />
            </form>
          )}
          {renewal === "not_yet" && c.status === "active" && (
            <p className="pb-2 text-xs text-muted">
              Renewal opens {c.ends_on ? `${c.renewal_window_days} days before ${c.ends_on}` : "later"}.
            </p>
          )}
          {c.status !== "terminated" && c.status !== "draft" && (
            <form action={terminateContract} className="ml-auto flex items-end gap-2">
              <input type="hidden" name="id" value={c.id} />
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Ends on</label>
                <input name="ends_on" type="date" defaultValue={day} className="input mono-num" />
              </div>
              <ActionButton icon="x" tip="Terminate — every account stops billing on this day" label="Terminate" variant="danger" />
            </form>
          )}
          {c.status === "draft" && can(cu, "contracts", "delete") && (
            <form action={deleteContract} className="ml-auto">
              <input type="hidden" name="id" value={c.id} />
              <ActionButton icon="trash" tip="Delete this draft" variant="danger" />
            </form>
          )}
        </section>
      )}

      {/* ---------- invoices ---------- */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Invoices for this party</h2>
        <Table head={["ID", "Month", "Direction", "Total", "Status", ""]}>
          {(invoices ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-muted">Nothing billed yet.</td>
            </tr>
          )}
          {((invoices ?? []) as { id: string; ref: string | null; period_month: string; total: number; currency: string; status: string; direction: string }[]).map(
            (inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-surface-raised">
                <td className="mono-num px-4 py-2.5 text-xs text-muted">{inv.ref ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{inv.period_month.slice(0, 7)}</td>
                <td className="px-4 py-2.5 text-muted">{inv.direction === "receivable" ? "they pay" : "we pay"}</td>
                <td className="mono-num px-4 py-2.5">{fmtNum(inv.total)} {inv.currency}</td>
                <td className="px-4 py-2.5 capitalize text-muted">{inv.status}</td>
                <td className="px-4 py-2.5 text-right">
                  <RowSettings href={`/admin/billing/invoices/${inv.id}`} tip="Open this invoice" />
                </td>
              </tr>
            )
          )}
        </Table>
      </section>

      <AuditLine createdBy={c.created_by} createdAt={c.created_at} updatedBy={c.updated_by} updatedAt={null} />
    </div>
  );
}

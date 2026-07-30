import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { claim, buildClaimContext } from "@/modules/claims/lib";
import { confirmClaim, blacklistCompany, closeClaim } from "@/modules/claims/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";
import type { ClaimComputation } from "@/modules/billing/engine";

// The whole computation, shown before anything is committed — and stored once
// it is, so the record always explains itself.
export default async function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; refunded?: string }>;
}) {
  const { cu } = await requirePerm("claims", "view");
  const { id } = await params;
  const { error, saved, refunded } = await searchParams;
  const c = await claim(id);
  if (!c) notFound();

  const ctx = await buildClaimContext(c);
  // Once confirmed the stored numbers are the record; live ones only preview.
  const comp: ClaimComputation = (c.computation as ClaimComputation | null) ?? ctx.computation;
  const canEdit = Boolean(can(cu, "claims", "edit"));

  const row = (label: string, value: string, sub?: string, danger?: boolean) => (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div>
        <p className="text-sm">{label}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      <p className={`mono-num text-sm font-semibold ${danger ? "text-danger" : ""}`}>{value}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/compensation" className="text-xs text-muted hover:text-foreground">← Compensation</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">
            {fmtNum(c.amount)} taken from {c.bank_account?.bank?.name ?? "?"} {c.bank_account?.account_no}
          </h1>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
            {c.status}
          </span>
          {c.ref && <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{c.ref}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {c.bank_account?.company?.name ?? "no company"} · reported {new Date(c.created_at).toLocaleString()}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "confirmed" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Committed: the customer&apos;s wallet is credited; the agent&apos;s debt deducts from their future payouts.
        </p>
      )}
      {saved === "blacklisted" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Company blacklisted — every account under it is suspended and frozen
          {refunded && refunded !== "0" ? `, ${refunded} innocent customer(s) refunded pro rata` : ""}.
        </p>
      )}
      {c.description && <p className="card px-5 py-4 text-sm">{c.description}</p>}

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">We compensate the customer</h2>
        <p className="mb-2 text-xs text-muted">
          {ctx.customer ? ctx.customer.name : "No customer is renting this account"} — capped at their own written
          deposit{ctx.customer ? ` of ${fmtNum(ctx.customer.contract_deposit)}` : ""}.
        </p>
        <div className="divide-y divide-border">
          {row("Compensation", fmtNum(comp.customer_compensation))}
          {comp.customer_setup_fee_refund > 0 &&
            row("Setup fee refund", fmtNum(comp.customer_setup_fee_refund), "stolen within 30 days of their start")}
          {row("Written off", fmtNum(comp.written_off), "beyond the cap — not carried as anyone's debt", true)}
        </div>
        <p className="mt-2 text-xs text-muted">
          Paid as wallet credit: it offsets their next invoices, and with nothing to offset it is transferred.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">The agent owes us</h2>
        <p className="mb-2 text-xs text-muted">
          {ctx.agent ? ctx.agent.name : "No agent contract covers this account"} —{" "}
          {comp.inside_agent_window
            ? `inside their ${ctx.agent?.window_months ?? "?"}-month window (company registered ${ctx.company?.registered_on ?? "?"})`
            : "outside their liability window, so only the deposit"}
          .
        </p>
        <div className="divide-y divide-border">
          {row("Deposit", fmtNum(comp.agent_deposit_due), "capped at their own written deposit")}
          {comp.inside_agent_window && row("Company funding back", fmtNum(comp.agent_company_due))}
          {comp.inside_agent_window &&
            row(
              "Rent already paid out",
              fmtNum(comp.agent_rent_due),
              `base ${fmtNum(ctx.rent_paid_base)} as billed + turnover ${fmtNum(ctx.rent_paid_turnover)} whole`
            )}
          {row("Total", fmtNum(comp.agent_total_due))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Recovered from the agent&apos;s future rent, payout by payout. Their owners&apos; rent is never touched;
          anything unrecoverable is negotiated outside the system.
        </p>
      </section>

      {canEdit && (
        <section className="card flex flex-wrap items-center gap-3 p-5">
          {c.status === "open" && (
            <form action={confirmClaim}>
              <input type="hidden" name="id" value={c.id} />
              <ActionButton
                icon="check"
                tip="Commit these numbers: credit the customer, debit the agent"
                label="Confirm Compensation"
                variant="success"
              />
            </form>
          )}
          {c.status !== "open" && c.bank_account?.company && (
            <form action={blacklistCompany}>
              <input type="hidden" name="id" value={c.id} />
              <ActionButton
                icon="x"
                tip={`Blacklist ${c.bank_account.company.name}: suspend every account under it and refund the innocent customers pro rata`}
                label="Blacklist Company"
                variant="danger"
              />
            </form>
          )}
          {c.status === "confirmed" && (
            <form action={closeClaim} className="ml-auto">
              <input type="hidden" name="id" value={c.id} />
              <ActionButton icon="check" tip="Everything recovered or negotiated — close the file" label="Close" />
            </form>
          )}
        </section>
      )}
    </div>
  );
}

import "server-only";
import { db } from "@/lib/supabase";
import { linesForAccount, turnoverTopup, type AccountLine, type BilledLine } from "./engine";
import type { Contract } from "@/modules/contracts/lib";

// Turning contracts into a month's invoices. The arithmetic lives in engine.ts;
// this file only feeds it and writes what it returns.

export type RunSummary = {
  run: { id: string; period_month: string; status: string; created_at: string; issued_at: string | null };
  invoices: InvoiceRow[];
  warnings: string[];
};

export type InvoiceRow = {
  id: string;
  ref: string | null;
  direction: "receivable" | "payable";
  party_type: "customer" | "agent" | "owner";
  period_month: string;
  currency: string;
  total: number;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  customer: { name: string; ref: string | null } | null;
  agent: { full_name: string; ref: string | null } | null;
  owner: { full_name: string | null; ref: string | null } | null;
  merchant: { name: string } | null;
  invoice_lines: InvoiceLine[];
};

export type InvoiceLine = {
  id: string;
  kind: string;
  description: string;
  period_start: string | null;
  period_end: string | null;
  days: number | null;
  days_in_month: number | null;
  amount: number;
  snapshot: Record<string, unknown>;
};

export const INVOICE_SELECT =
  "*, customer:customers(name, ref), agent:agents(full_name, ref), owner:owners(full_name, ref), merchant:merchants(name), invoice_lines(*)";

export function partyLabel(inv: InvoiceRow): string {
  if (inv.party_type === "customer") return inv.customer?.name ?? "(customer)";
  if (inv.party_type === "agent") return inv.agent?.full_name ?? "(agent)";
  return inv.owner?.full_name ?? "(owner)";
}

type LoadedContract = Contract & {
  contract_accounts: {
    id: string;
    bank_account_id: string;
    starts_on: string | null;
    ends_on: string | null;
    setup_fee: number;
    setup_fee_invoiced_at: string | null;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
    contract_terms: {
      base_rent: number;
      turnover_rate: number | null;
      mode?: "rent" | "turnover" | "rent_plus_turnover" | "max";
      effective_from: string;
      effective_to: string | null;
    }[];
  }[];
};

/**
 * Build (or rebuild) the draft run for a country and month. Any previous draft
 * for the month is discarded first — that is what Recalculate means. Lines that
 * were already issued keep their dedupe keys, so rebuilding can only add what
 * is missing, never bill twice.
 */
export async function buildDraft(countryId: string, periodMonth: string, userId: string): Promise<string> {
  // The picture must be current before any arithmetic: overdue tickets freeze
  // their accounts right here, and assignments past their 14-day cap start
  // billing whether or not anyone clicked anything.
  const { applyOverdueFreezes } = await import("@/modules/tickets/lib");
  await applyOverdueFreezes();
  const { applyAssignmentDeadlines } = await import("@/modules/contracts/customer-policy");
  await applyAssignmentDeadlines();

  // Out with the old draft.
  const { data: existing } = await db()
    .from("billing_runs")
    .select("id")
    .eq("country_id", countryId)
    .eq("period_month", periodMonth)
    .eq("status", "draft")
    .maybeSingle();
  if (existing) {
    await db().from("invoices").delete().eq("run_id", existing.id).eq("status", "draft");
    await db().from("billing_runs").delete().eq("id", existing.id);
  }

  const { data: runRow, error: runError } = await db()
    .from("billing_runs")
    .insert({ country_id: countryId, period_month: periodMonth, created_by: userId })
    .select("id")
    .single();
  if (runError || !runRow) throw new Error(runError?.message ?? "Failed to open the run");
  const runId = runRow.id as string;

  const { data: currency } = await db().from("countries").select("currency").eq("id", countryId).maybeSingle();

  const { data: contractRows } = await db()
    .from("contracts")
    .select(
      "*, contract_accounts(*, bank_account:bank_accounts(account_no, billing_frozen, bank:banks(name)), contract_terms(*))"
    )
    .eq("country_id", countryId)
    .eq("status", "active");
  const loaded = (contractRows ?? []) as unknown as LoadedContract[];

  // Approved turnover for last month drives the top-ups raised this run. The
  // same figure serves the customer's rate and the agent's own rate.
  const { firstOfMonth, addMonths } = await import("./engine");
  const prevMonth = firstOfMonth(addMonths(periodMonth, -1));
  const { data: declRows } = await db()
    .from("turnover_declarations")
    .select("bank_account_id, amount")
    .eq("period_month", prevMonth)
    .eq("status", "approved");
  const turnoverByAccount = new Map(
    ((declRows ?? []) as { bank_account_id: string; amount: number }[]).map((d) => [
      d.bank_account_id,
      Number(d.amount),
    ])
  );

  // The keys already billed on issued invoices — those lines must not reappear.
  const { data: issuedLines } = await db()
    .from("invoice_lines")
    .select("dedupe_key, invoice:invoices!inner(status)")
    .neq("invoice.status", "draft");
  const alreadyBilled = new Set(((issuedLines ?? []) as { dedupe_key: string }[]).map((l) => l.dedupe_key));

  // Closed, unwaived, uninvoiced ticket charges join the customer's invoice.
  const { data: chargeRows } = await db()
    .from("tickets")
    .select("id, ref, customer_id, charge_amount, charge_kind, type:ticket_types(name)")
    .eq("country_id", countryId)
    .in("status", ["handled", "resolved"])
    .eq("charge_waived", false)
    .is("charge_invoiced_at", null)
    .not("charge_amount", "is", null);
  const chargesByCustomer = new Map<string, { id: string; ref: string | null; amount: number; label: string }[]>();
  for (const t of (chargeRows ?? []) as unknown as {
    id: string; ref: string | null; customer_id: string; charge_amount: number; charge_kind: string;
    type: { name: string } | null;
  }[]) {
    const list = chargesByCustomer.get(t.customer_id) ?? [];
    list.push({
      id: t.id,
      ref: t.ref,
      amount: Number(t.charge_amount),
      label: `Service — ${t.type?.name ?? "support"} (${t.charge_kind === "phone" ? "phone call" : "bank visit"}, ${t.ref ?? t.id})`,
    });
    chargesByCustomer.set(t.customer_id, list);
  }
  const chargedCustomers = new Set<string>();

  for (const c of loaded) {
    const lines: BilledLine[] = [];

    if (c.party_type === "customer" && c.customer_id && !chargedCustomers.has(c.customer_id)) {
      chargedCustomers.add(c.customer_id);
      for (const charge of chargesByCustomer.get(c.customer_id) ?? []) {
        lines.push({
          contract_account_id: null,
          kind: "service",
          description: charge.label,
          period_start: null,
          period_end: null,
          days: null,
          days_in_month: null,
          amount: charge.amount,
          dedupe_key: `service|${charge.id}`,
          snapshot: { ticket_id: charge.id, ticket_ref: charge.ref },
        });
      }
    }
    for (const acc of c.contract_accounts) {
      if (!acc.starts_on) continue;
      // A frozen account bills nobody — customer, owner and agent alike. The
      // term keeps running; only the money stops.
      if ((acc.bank_account as { billing_frozen?: boolean } | null)?.billing_frozen) continue;
      // An account never bills past its contract: no renewal, no rent.
      const contractEnd = c.ends_on;
      const effectiveEnd =
        acc.ends_on && contractEnd
          ? acc.ends_on < contractEnd
            ? acc.ends_on
            : contractEnd
          : acc.ends_on ?? contractEnd;
      const accountLine: AccountLine = {
        contract_account_id: acc.id,
        starts_on: acc.starts_on,
        ends_on: effectiveEnd,
        setup_fee: acc.setup_fee,
        setup_fee_invoiced: Boolean(acc.setup_fee_invoiced_at),
        terms: acc.contract_terms,
      };
      const name = acc.bank_account
        ? `${acc.bank_account.bank?.name ?? "?"} ${acc.bank_account.account_no}`
        : "account";
      const raised = linesForAccount(accountLine, periodMonth);

      // Owners have no turnover component; customers and agents may.
      const turnover = turnoverByAccount.get(acc.bank_account_id);
      if (turnover != null && c.party_type !== "owner") {
        const topup = turnoverTopup(accountLine, prevMonth, turnover);
        if (topup) raised.push(topup);
      }

      for (const line of raised) {
        if (alreadyBilled.has(line.dedupe_key)) continue;
        lines.push({ ...line, description: `${name} — ${line.description}` });
      }
    }
    // An agent owing recovery money has it taken out of this payout, down to
    // zero — never into the negative, and never from any owner's invoice.
    if (c.party_type === "agent" && c.agent_id && lines.length > 0) {
      const { ledgerFor } = await import("./ledger");
      const { balance } = await ledgerFor("agent", c.agent_id);
      if (balance < 0) {
        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        const deduction = Math.min(subtotal, -balance);
        if (deduction > 0) {
          lines.push({
            contract_account_id: null,
            kind: "adjustment",
            description: `Recovery deduction (owed ${(-balance).toLocaleString()})`,
            period_start: null,
            period_end: null,
            days: null,
            days_in_month: null,
            amount: -Math.round(deduction * 100) / 100,
            dedupe_key: `recovery|${c.agent_id}|${periodMonth}`,
            snapshot: { owed_before: -balance, deducted: deduction },
          });
        }
      }
    }

    if (lines.length === 0) continue;

    const { data: inv, error: invError } = await db()
      .from("invoices")
      .insert({
        merchant_id: c.merchant_id,
        country_id: c.country_id,
        run_id: runId,
        direction: c.party_type === "customer" ? "receivable" : "payable",
        party_type: c.party_type,
        customer_id: c.customer_id,
        agent_id: c.agent_id,
        owner_id: c.owner_id,
        period_month: periodMonth,
        currency: (currency?.currency as string | undefined) ?? "THB",
        total: lines.reduce((s, l) => s + l.amount, 0),
        created_by: userId,
      })
      .select("id")
      .single();
    if (invError || !inv) throw new Error(invError?.message ?? "Failed to create an invoice");

    const { error: linesError } = await db()
      .from("invoice_lines")
      .upsert(
        lines.map((l) => ({
          invoice_id: inv.id,
          contract_account_id: l.contract_account_id,
          kind: l.kind,
          description: l.description,
          period_start: l.period_start,
          period_end: l.period_end,
          days: l.days,
          days_in_month: l.days_in_month,
          snapshot: l.snapshot,
          amount: l.amount,
          dedupe_key: l.dedupe_key,
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      );
    if (linesError) throw new Error(linesError.message);

    // The safety net may have dropped duplicates — the total is what landed.
    // An invoice with lines but a zero total stays: a payout fully consumed by
    // a recovery deduction must still issue, or the debt never shrinks.
    const { data: landed } = await db().from("invoice_lines").select("amount").eq("invoice_id", inv.id);
    const rows = (landed ?? []) as { amount: number }[];
    const total = rows.reduce((s, l) => s + Number(l.amount), 0);
    if (rows.length === 0) await db().from("invoices").delete().eq("id", inv.id);
    else await db().from("invoices").update({ total }).eq("id", inv.id);
  }

  return runId;
}

/** The draft (or issued) run for a month, with everything on it. */
export async function runForMonth(countryId: string, periodMonth: string): Promise<RunSummary | null> {
  const { data: run } = await db()
    .from("billing_runs")
    .select("*")
    .eq("country_id", countryId)
    .eq("period_month", periodMonth)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return null;

  const { data: invoices } = await db()
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("run_id", run.id)
    .order("direction")
    .order("total", { ascending: false });

  const rows = (invoices ?? []) as unknown as InvoiceRow[];
  const warnings: string[] = [];
  const skipped = rows.filter((i) => i.invoice_lines.length === 0).length;
  if (skipped > 0) warnings.push(`${skipped} invoice(s) have no lines`);

  return {
    run: run as RunSummary["run"],
    invoices: rows,
    warnings,
  };
}

/** Everything a run needs to become real: issue the invoices, stamp the fees. */
export async function issueRun(runId: string, userId: string): Promise<number> {
  const now = new Date().toISOString();

  const { data: invoices } = await db().from("invoices").select("id").eq("run_id", runId).eq("status", "draft");
  const ids = ((invoices ?? []) as { id: string }[]).map((i) => i.id);
  if (ids.length === 0) return 0;

  // Lock today's USDT figure onto every invoice: what is quoted is what is due,
  // whenever it is actually paid.
  const { effectiveRates, usdtAmount } = await import("./fx");
  const { data: run } = await db().from("billing_runs").select("country_id").eq("id", runId).maybeSingle();
  const { data: countryRow } = run
    ? await db()
        .from("countries")
        .select("currency, usdt_markup_pct, usdt_markup_flat")
        .eq("id", run.country_id)
        .maybeSingle()
    : { data: null };
  let rates: Awaited<ReturnType<typeof effectiveRates>> | null = null;
  if (countryRow) {
    try {
      rates = await effectiveRates(countryRow as { currency: string; usdt_markup_pct: number; usdt_markup_flat: number });
    } catch {
      rates = null; // issue without USDT figures rather than blocking the run
    }
  }

  await db().from("invoices").update({ status: "issued", issued_at: now }).in("id", ids);

  if (rates) {
    const { data: toRate } = await db().from("invoices").select("id, direction, total").in("id", ids);
    for (const inv of (toRate ?? []) as { id: string; direction: string; total: number }[]) {
      const rate = inv.direction === "receivable" ? rates.receivable : rates.payable;
      await db()
        .from("invoices")
        .update({ usdt_rate: rate, usdt_total: usdtAmount(Number(inv.total), rate) })
        .eq("id", inv.id);
    }
  }

  // A setup fee that has now been billed must never be billed again.
  const { data: feeLines } = await db()
    .from("invoice_lines")
    .select("contract_account_id")
    .in("invoice_id", ids)
    .eq("kind", "setup_fee");
  const feeAccounts = [
    ...new Set(
      ((feeLines ?? []) as { contract_account_id: string | null }[])
        .map((l) => l.contract_account_id)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  if (feeAccounts.length > 0) {
    await db()
      .from("contract_accounts")
      .update({ setup_fee_invoiced_at: now })
      .in("id", feeAccounts)
      .is("setup_fee_invoiced_at", null);
  }

  // Recovery deductions that just went out shrink the agent's debt.
  const { data: recoveryLines } = await db()
    .from("invoice_lines")
    .select("amount, dedupe_key, invoice_id, invoice:invoices!inner(agent_id, merchant_id, country_id, currency)")
    .in("invoice_id", ids)
    .eq("kind", "adjustment")
    .like("dedupe_key", "recovery|%");
  for (const l of (recoveryLines ?? []) as unknown as {
    amount: number;
    invoice_id: string;
    invoice: { agent_id: string | null; merchant_id: string; country_id: string | null; currency: string };
  }[]) {
    if (!l.invoice.agent_id) continue;
    await db().from("ledger_entries").insert({
      merchant_id: l.invoice.merchant_id,
      country_id: l.invoice.country_id,
      holder_type: "agent",
      holder_id: l.invoice.agent_id,
      currency: l.invoice.currency,
      amount: -Number(l.amount), // the line is negative; the ledger credit is positive
      kind: "adjustment",
      invoice_id: l.invoice_id,
      note: "Recovery deducted from this payout",
      created_by: userId,
    });
  }

  // Service charges that just went out never join another run.
  const { data: serviceLines } = await db()
    .from("invoice_lines")
    .select("dedupe_key")
    .in("invoice_id", ids)
    .eq("kind", "service");
  const ticketIds = ((serviceLines ?? []) as { dedupe_key: string }[])
    .map((l) => l.dedupe_key.split("|")[1])
    .filter(Boolean);
  if (ticketIds.length > 0) {
    await db()
      .from("tickets")
      .update({ charge_invoiced_at: now })
      .in("id", ticketIds)
      .is("charge_invoiced_at", null);
  }

  await db().from("billing_runs").update({ status: "issued", issued_at: now, issued_by: userId }).eq("id", runId);
  return ids.length;
}

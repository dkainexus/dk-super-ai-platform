import "server-only";
import { db } from "@/lib/supabase";
import { computeClaim, type ClaimComputation } from "@/modules/billing/engine";

export type Claim = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  bank_account_id: string;
  amount: number;
  description: string | null;
  status: "open" | "confirmed" | "closed";
  computation: ClaimComputation | null;
  customer_compensation: number | null;
  agent_recovery: number | null;
  confirmed_at: string | null;
  created_at: string;
};

export type ClaimRow = Claim & {
  bank_account: {
    account_no: string;
    company_id: string;
    bank: { name: string } | null;
    company: { id: string; name: string } | null;
  } | null;
};

export const CLAIM_SELECT =
  "*, bank_account:bank_accounts(account_no, company_id, bank:banks(name), company:companies(id, name))";

export async function claims(countryId?: string): Promise<ClaimRow[]> {
  let q = db().from("claims").select(CLAIM_SELECT).order("created_at", { ascending: false });
  if (countryId) q = q.eq("country_id", countryId);
  const { data } = await q;
  return (data ?? []) as unknown as ClaimRow[];
}

export async function claim(id: string): Promise<ClaimRow | null> {
  const { data } = await db().from("claims").select(CLAIM_SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as ClaimRow | null;
}

export type ClaimContext = {
  computation: ClaimComputation;
  customer: { id: string; name: string; contract_deposit: number } | null;
  agent: { id: string; name: string; deposit: number; window_months: number | null } | null;
  company: { id: string; name: string; registered_on: string | null; contribution: number } | null;
  rent_paid_base: number;
  rent_paid_turnover: number;
  setup_fee: number;
  customer_started_on: string | null;
};

/**
 * Everything a claim needs, gathered live: the parties' deposits from their
 * contracts, the company's funding, and what has actually been paid out for
 * this account. Shown before anything is committed; stored when it is.
 */
export async function buildClaimContext(c: Claim): Promise<ClaimContext> {
  const today = new Date().toISOString().slice(0, 10);

  // Whose account, which company, which contracts touch it.
  const { data: acc } = await db()
    .from("bank_accounts")
    .select("id, company_id, company:companies(id, name, status, business_start_date, created_at)")
    .eq("id", c.bank_account_id)
    .maybeSingle();
  const company = (acc?.company ?? null) as {
    id: string; name: string; business_start_date: string | null; created_at: string;
  } | null;

  const { data: lines } = await db()
    .from("contract_accounts")
    .select(
      "id, starts_on, setup_fee, contract:contracts!inner(id, party_type, deposit, theft_window_months, customer_id, agent_id, customer:customers(id, name), agent:agents(id, full_name))"
    )
    .eq("bank_account_id", c.bank_account_id);
  type Line = {
    id: string;
    starts_on: string | null;
    setup_fee: number;
    contract: {
      party_type: string;
      deposit: number;
      theft_window_months: number | null;
      customer: { id: string; name: string } | null;
      agent: { id: string; full_name: string } | null;
    };
  };
  const all = (lines ?? []) as unknown as Line[];
  const customerLine = all.find((l) => l.contract.party_type === "customer") ?? null;
  const agentLine = all.find((l) => l.contract.party_type === "agent") ?? null;

  // What has actually been paid out to the owner and agent for this account.
  const lineIds = all.map((l) => l.id);
  let rentBase = 0;
  let rentTurnover = 0;
  if (lineIds.length > 0) {
    const { data: paidLines } = await db()
      .from("invoice_lines")
      .select("amount, kind, contract_account_id, invoice:invoices!inner(status, direction)")
      .in("contract_account_id", lineIds)
      .eq("invoice.direction", "payable")
      .eq("invoice.status", "paid");
    for (const l of (paidLines ?? []) as { amount: number; kind: string }[]) {
      if (l.kind === "turnover_topup") rentTurnover += Number(l.amount);
      else rentBase += Number(l.amount);
    }
  }

  // What the white label put in for this company.
  let contribution = 0;
  if (company) {
    const { data: fund } = await db()
      .from("ledger_entries")
      .select("amount")
      .eq("holder_type", "merchant")
      .eq("kind", "adjustment")
      .ilike("note", `company:${company.id}%`);
    contribution = ((fund ?? []) as { amount: number }[]).reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
  }

  const computation = computeClaim({
    stolen: Number(c.amount),
    customerDeposit: Number(customerLine?.contract.deposit ?? 0),
    agentDeposit: Number(agentLine?.contract.deposit ?? 0),
    agentWindowMonths: agentLine?.contract.theft_window_months ?? null,
    companyRegisteredOn: company?.business_start_date ?? company?.created_at?.slice(0, 10) ?? null,
    claimedOn: today,
    companyContribution: contribution,
    rentPaidBase: rentBase,
    rentPaidTurnover: rentTurnover,
    setupFee: Number(customerLine?.setup_fee ?? 0),
    customerStartedOn: customerLine?.starts_on ?? null,
  });

  return {
    computation,
    customer: customerLine?.contract.customer
      ? {
          id: customerLine.contract.customer.id,
          name: customerLine.contract.customer.name,
          contract_deposit: Number(customerLine.contract.deposit),
        }
      : null,
    agent: agentLine?.contract.agent
      ? {
          id: agentLine.contract.agent.id,
          name: agentLine.contract.agent.full_name,
          deposit: Number(agentLine.contract.deposit),
          window_months: agentLine.contract.theft_window_months,
        }
      : null,
    company: company
      ? {
          id: company.id,
          name: company.name,
          registered_on: company.business_start_date ?? company.created_at?.slice(0, 10) ?? null,
          contribution,
        }
      : null,
    rent_paid_base: rentBase,
    rent_paid_turnover: rentTurnover,
    setup_fee: Number(customerLine?.setup_fee ?? 0),
    customer_started_on: customerLine?.starts_on ?? null,
  };
}

import "server-only";
import { db } from "@/lib/supabase";
import { addDays, addMonths, termStart } from "@/modules/billing/engine";

export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export type Contract = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  party_type: "customer" | "agent" | "owner";
  customer_id: string | null;
  agent_id: string | null;
  owner_id: string | null;
  min_term_months: number;
  renewal_min_months: number;
  renewal_window_days: number;
  lead_days: number;
  deposit: number;
  theft_window_months: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: ContractStatus;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ContractAccount = {
  id: string;
  contract_id: string;
  bank_account_id: string;
  starts_on: string | null;
  ends_on: string | null;
  setup_fee: number;
  setup_fee_invoiced_at: string | null;
};

export type Terms = {
  id: string;
  contract_account_id: string;
  base_rent: number;
  turnover_rate: number | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

export type ContractRow = Contract & {
  merchant: { name: string } | null;
  customer: { name: string; ref: string | null } | null;
  agent: { full_name: string; ref: string | null } | null;
  owner: { full_name: string | null; ref: string | null } | null;
  contract_accounts: { count: number }[];
};

export type ContractAccountRow = ContractAccount & {
  bank_account: { ref: string | null; account_no: string; bank: { name: string; code: string | null } | null } | null;
  contract_terms: Terms[];
};

export const CONTRACT_SELECT =
  "*, merchant:merchants(name), customer:customers(name, ref), agent:agents(full_name, ref), owner:owners(full_name, ref), contract_accounts(count)";

export function partyName(c: ContractRow): string {
  if (c.party_type === "customer") return c.customer?.name ?? "(customer)";
  if (c.party_type === "agent") return c.agent?.full_name ?? "(agent)";
  return c.owner?.full_name ?? "(owner)";
}

export async function contracts(opts: {
  countryId?: string;
  merchantId?: string;
  partyType?: string;
  status?: string;
}): Promise<ContractRow[]> {
  let q = db().from("contracts").select(CONTRACT_SELECT).order("created_at", { ascending: false });
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.partyType) q = q.eq("party_type", opts.partyType);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as unknown as ContractRow[];
}

export async function contract(id: string): Promise<ContractRow | null> {
  const { data } = await db().from("contracts").select(CONTRACT_SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as ContractRow | null;
}

export async function contractAccounts(contractId: string): Promise<ContractAccountRow[]> {
  const { data } = await db()
    .from("contract_accounts")
    .select("*, bank_account:bank_accounts(ref, account_no, bank:banks(name, code)), contract_terms(*)")
    .eq("contract_id", contractId)
    .order("created_at");
  return (data ?? []) as unknown as ContractAccountRow[];
}

/** The version of the terms in force today, for display. */
export function currentTerms(terms: Terms[], today: string): Terms | null {
  const live = terms
    .filter((t) => t.effective_from <= today && (!t.effective_to || t.effective_to >= today))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return live[0] ?? terms.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0] ?? null;
}

export const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Where a contract stands against its dates: whether the renewal window is
 * open, closed, or not yet reached.
 */
export function renewalState(c: Contract, onDay: string): "not_yet" | "open" | "closed" | "none" {
  if (!c.ends_on || c.status === "terminated" || c.status === "draft") return "none";
  const windowOpens = addDays(c.ends_on, -c.renewal_window_days);
  if (onDay < windowOpens) return "not_yet";
  if (onDay <= c.ends_on) return "open";
  return "closed";
}

/** The term dates that activating a contract fixes, from its earliest account. */
export function activationDates(
  accountStarts: string[],
  minTermMonths: number
): { starts_on: string; ends_on: string } | null {
  if (accountStarts.length === 0) return null;
  const earliest = [...accountStarts].sort()[0];
  const starts = termStart(earliest);
  return { starts_on: starts, ends_on: addDays(addMonths(starts, minTermMonths), -1) };
}

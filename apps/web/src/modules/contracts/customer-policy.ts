import "server-only";
import { db } from "@/lib/supabase";
import { addDays, firstOfMonth, addMonths } from "@/modules/billing/engine";
import type { ConditionRow } from "./policy";

// The customer side of the policy layer: default conditions per customer,
// the assignment lifecycle, and the versioned terms & conditions text.

export type CustomerConditionRow = ConditionRow & { setup_fee: number; customer_id: string | null };

export type Assignment = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  bank_account_id: string;
  customer_id: string;
  delivery_method: "mail" | "direct";
  status: "awaiting_confirmation" | "confirmed" | "live" | "cancelled";
  conditions: Record<string, unknown>;
  tnc_id: string | null;
  address: { name: string; phone: string; address: string } | null;
  assigned_on: string;
  confirmed_at: string | null;
  live_on: string | null;
  contract_account_id: string | null;
  binding_ticket_id: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type AssignmentRow = Assignment & {
  customer: { name: string; ref: string | null } | null;
  bank_account: { account_no: string; bank: { name: string } | null } | null;
  tnc: { version: number; title: string } | null;
};

export const ASSIGNMENT_SELECT =
  "*, customer:customers(name, ref), bank_account:bank_accounts(account_no, bank:banks(name)), tnc:terms_documents(version, title)";

/** A customer's own rows, or the platform template for the country (customerId null). */
export async function customerConditionRows(
  countryId: string,
  customerId: string | null
): Promise<CustomerConditionRow[]> {
  let q = db()
    .from("customer_condition_rows")
    .select("*, bank:banks(name)")
    .eq("country_id", countryId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  q = customerId ? q.eq("customer_id", customerId) : q.is("customer_id", null).is("merchant_id", null);
  const { data } = await q;
  return (data ?? []) as unknown as CustomerConditionRow[];
}

/** Stamp the platform template onto a fresh customer. */
export async function copyTemplateToCustomer(
  countryId: string,
  customerId: string,
  merchantId: string,
  byUserId: string
): Promise<number> {
  const existing = await customerConditionRows(countryId, customerId);
  if (existing.length > 0) return 0;
  const template = await customerConditionRows(countryId, null);
  if (template.length === 0) return 0;
  await db()
    .from("customer_condition_rows")
    .insert(
      template.map((r) => ({
        country_id: countryId,
        merchant_id: merchantId,
        customer_id: customerId,
        bank_id: r.bank_id,
        channel: r.channel,
        mode: r.mode,
        rent: r.rent,
        turnover_pct: r.turnover_pct,
        setup_fee: r.setup_fee,
        deposit: r.deposit,
        contract_months: r.contract_months,
        renewal_months: r.renewal_months,
        sort: r.sort,
        created_by: byUserId,
      }))
    );
  return template.length;
}

/** The current T&C for a country — the white label's own, else the platform's. */
export async function currentTnc(
  countryId: string,
  merchantId: string | null
): Promise<{ id: string; version: number; title: string; body: string } | null> {
  if (merchantId) {
    const { data } = await db()
      .from("terms_documents")
      .select("id, version, title, body")
      .eq("country_id", countryId)
      .eq("merchant_id", merchantId)
      .order("version", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0] as { id: string; version: number; title: string; body: string };
  }
  const { data } = await db()
    .from("terms_documents")
    .select("id, version, title, body")
    .eq("country_id", countryId)
    .is("merchant_id", null)
    .order("version", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] ?? null) as { id: string; version: number; title: string; body: string } | null;
}

export async function assignmentsFor(opts: {
  countryId?: string;
  customerId?: string;
  status?: string;
}): Promise<AssignmentRow[]> {
  let q = db().from("account_assignments").select(ASSIGNMENT_SELECT).order("created_at", { ascending: false });
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as unknown as AssignmentRow[];
}

/**
 * Wire the customer's billing contract from a confirmed assignment: one
 * contract per account (deposit and window are the row's own), the account
 * attached with the frozen conditions, and billing dormant until live_on.
 */
export async function wireCustomerContract(a: Assignment, byUserId: string | null): Promise<string | null> {
  if (a.contract_account_id) return null;
  const c = a.conditions as {
    mode?: string; rent?: number; turnover_pct?: number | null; setup_fee?: number; deposit?: number;
    contract_months?: number | null; renewal_months?: number | null;
  };
  const { data: contract, error } = await db()
    .from("contracts")
    .insert({
      merchant_id: a.merchant_id,
      country_id: a.country_id,
      party_type: "customer",
      customer_id: a.customer_id,
      min_term_months: c.contract_months ?? 0,
      renewal_min_months: c.renewal_months ?? 0,
      deposit: c.deposit ?? 0,
      status: "active",
      notes: `From assignment ${a.ref ?? a.id}`,
      created_by: byUserId,
    })
    .select("id")
    .single();
  if (error || !contract) return `Failed to open the contract: ${error?.message}`;

  const { data: ca, error: caErr } = await db()
    .from("contract_accounts")
    .insert({
      contract_id: contract.id,
      bank_account_id: a.bank_account_id,
      starts_on: a.live_on, // null until it goes live — bills nothing till then
      setup_fee: c.setup_fee ?? 0,
      created_by: byUserId,
    })
    .select("id")
    .single();
  if (caErr || !ca) return `Failed to attach the account: ${caErr?.message}`;

  await db().from("contract_terms").insert({
    contract_account_id: ca.id,
    base_rent: c.mode === "turnover" ? 0 : c.rent ?? 0,
    turnover_rate: c.mode === "rent" ? null : c.turnover_pct ?? null,
    mode: c.mode ?? "max",
    effective_from: a.live_on ?? a.assigned_on,
    created_by: byUserId,
  });
  await db().from("account_assignments").update({ contract_account_id: ca.id }).eq("id", a.id);
  return null;
}

/** The latest allowed start: 14 days after assignment, no matter what. */
export const assignmentDeadline = (assignedOn: string) => addDays(assignedOn, 14);

/**
 * Take an assignment live from a given day: billing starts, the contract term
 * runs from the 1st of the following month for contract_months.
 */
export async function goLive(assignmentId: string, startOn: string, byUserId: string | null): Promise<string | null> {
  const { data } = await db().from("account_assignments").select("*").eq("id", assignmentId).maybeSingle();
  const a = data as Assignment | null;
  if (!a) return "Assignment not found";
  if (a.status === "live") return null;
  if (a.status === "cancelled") return "This assignment was cancelled";

  // Never later than the deadline.
  const start = startOn > assignmentDeadline(a.assigned_on) ? assignmentDeadline(a.assigned_on) : startOn;

  a.live_on = start;
  const wireError = await wireCustomerContract(a, byUserId);
  if (wireError) return wireError;

  // The contract may already exist from confirmation — stamp the start.
  const { data: fresh } = await db()
    .from("account_assignments")
    .select("contract_account_id")
    .eq("id", assignmentId)
    .maybeSingle();
  const caId = (fresh?.contract_account_id as string | null) ?? a.contract_account_id;
  if (caId) {
    await db().from("contract_accounts").update({ starts_on: start }).eq("id", caId).is("starts_on", null);
    await db().from("contract_terms").update({ effective_from: start }).eq("contract_account_id", caId).gt("effective_from", start);
    const c = a.conditions as { contract_months?: number | null };
    if (c.contract_months) {
      const { data: caRow } = await db().from("contract_accounts").select("contract_id").eq("id", caId).maybeSingle();
      if (caRow) {
        const termStart = firstOfMonth(addMonths(start, 1));
        await db()
          .from("contracts")
          .update({ starts_on: start, ends_on: addDays(addMonths(termStart, c.contract_months), -1) })
          .eq("id", caRow.contract_id);
      }
    }
  }

  await db()
    .from("account_assignments")
    .update({ status: "live", live_on: start, updated_at: new Date().toISOString(), updated_by: byUserId })
    .eq("id", assignmentId);
  return null;
}

/**
 * The 14-day backstop, run before every billing draft: anything assigned and
 * not yet live (confirmed or not) starts billing on day 14 regardless.
 */
export async function applyAssignmentDeadlines(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("account_assignments")
    .select("id, assigned_on")
    .in("status", ["awaiting_confirmation", "confirmed"]);
  for (const a of (data ?? []) as { id: string; assigned_on: string }[]) {
    const deadline = assignmentDeadline(a.assigned_on);
    if (deadline <= today) await goLive(a.id, deadline, null);
  }
}

/**
 * Owner and agent renewals, by the white label's mode: auto extends an
 * expiring contract by its renewal months and writes the record; manual means
 * WE press the button — until then an expired contract simply stops billing.
 * Customers never appear here: their renewal is their own click in the portal.
 */
export async function applyAutoRenewals(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("contracts")
    .select("id, party_type, merchant_id, ends_on, renewal_min_months, merchant:merchants(renew_owner_mode, renew_agent_mode)")
    .in("party_type", ["owner", "agent"])
    .eq("status", "active")
    .not("ends_on", "is", null)
    .lte("ends_on", today);
  for (const c of (data ?? []) as unknown as {
    id: string; party_type: string; ends_on: string; renewal_min_months: number;
    merchant: { renew_owner_mode: string; renew_agent_mode: string } | null;
  }[]) {
    const mode = c.party_type === "owner" ? c.merchant?.renew_owner_mode : c.merchant?.renew_agent_mode;
    if (mode !== "auto") continue;
    const months = Math.max(1, c.renewal_min_months || 1);
    // Catch up however many periods have passed, so a long gap can't bill wrong.
    let newEnd = c.ends_on;
    while (newEnd < today) newEnd = addMonths(newEnd, months);
    await db().from("contracts").update({ ends_on: newEnd }).eq("id", c.id);
    await db().from("contract_renewals").insert({
      contract_id: c.id,
      months,
      old_ends_on: c.ends_on,
      new_ends_on: newEnd,
      kind: "auto",
    });
  }
}

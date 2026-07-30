import "server-only";
import { db } from "@/lib/supabase";

export type TicketType = {
  id: string;
  country_id: string;
  merchant_id: string | null;
  name: string;
  default_assignee: "owner" | "phone_cs" | "customer";
  window_days: number;
  phone_price: number;
  visit_price: number;
  active: boolean;
};

export type Ticket = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  bank_account_id: string;
  customer_id: string;
  type_id: string | null;
  description: string;
  reported_balance: number | null;
  last_transaction: string | null;
  status: "open" | "assigned" | "handled" | "resolved";
  assigned_to: "owner" | "phone_cs" | "customer" | null;
  deadline: string | null;
  escort_required: boolean;
  escort_name: string | null;
  charge_amount: number | null;
  charge_kind: "phone" | "visit" | null;
  charge_waived: boolean;
  charge_invoiced_at: string | null;
  created_at: string;
  assigned_at: string | null;
  closed_at: string | null;
};

export type TicketRow = Ticket & {
  customer: { name: string; ref: string | null } | null;
  bank_account: { account_no: string; billing_frozen: boolean; bank: { name: string } | null } | null;
  type: { name: string } | null;
};

export const TICKET_SELECT =
  "*, customer:customers(name, ref), bank_account:bank_accounts(account_no, billing_frozen, bank:banks(name)), type:ticket_types(name)";

export const ASSIGNEE_LABEL: Record<string, string> = {
  owner: "Owner",
  phone_cs: "Phone CS",
  customer: "Customer",
};

/** Types for a country, the white label's own rows shadowing the defaults. */
export async function ticketTypesFor(countryId: string, merchantId?: string | null): Promise<TicketType[]> {
  const { data } = await db()
    .from("ticket_types")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort")
    .order("name");
  const all = (data ?? []) as TicketType[];
  if (!merchantId) return all.filter((t) => !t.merchant_id);
  const overridden = new Set(all.filter((t) => t.merchant_id === merchantId).map((t) => t.name));
  return all.filter((t) => t.merchant_id === merchantId || (!t.merchant_id && !overridden.has(t.name)));
}

export async function tickets(opts: { countryId?: string; status?: string }): Promise<TicketRow[]> {
  let q = db().from("tickets").select(TICKET_SELECT).order("created_at", { ascending: false }).limit(200);
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as unknown as TicketRow[];
}

export async function ticket(id: string): Promise<TicketRow | null> {
  const { data } = await db().from("tickets").select(TICKET_SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as TicketRow | null;
}

export const isOverdue = (t: Ticket, today: string) =>
  t.status === "assigned" && t.assigned_to === "owner" && t.deadline != null && t.deadline < today;

/**
 * The rule that stops the money: any ticket sitting with the owner past its
 * deadline freezes its account. Runs on the tickets page and inside every
 * billing draft, so a run is never built against a stale picture. CS can lift
 * a freeze by hand once the ticket moves.
 */
export async function applyOverdueFreezes(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("tickets")
    .select("id, ref, bank_account_id, bank_account:bank_accounts(billing_frozen)")
    .eq("status", "assigned")
    .eq("assigned_to", "owner")
    .lt("deadline", today);

  const overdue = ((data ?? []) as unknown as {
    id: string;
    ref: string | null;
    bank_account_id: string;
    bank_account: { billing_frozen: boolean } | null;
  }[]).filter((t) => !t.bank_account?.billing_frozen);

  for (const t of overdue) {
    await db()
      .from("bank_accounts")
      .update({
        billing_frozen: true,
        frozen_at: new Date().toISOString(),
        frozen_reason: `Ticket ${t.ref ?? t.id} passed its deadline with the owner not having acted`,
      })
      .eq("id", t.bank_account_id)
      .eq("billing_frozen", false);
  }
  return overdue.length;
}

/** The escort threshold for a white label in a country, if one is set. */
export async function escortThreshold(merchantId: string, countryId: string | null): Promise<number | null> {
  if (!countryId) return null;
  const { data } = await db()
    .from("merchant_countries")
    .select("escort_threshold")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .maybeSingle();
  const v = data?.escort_threshold;
  return v == null ? null : Number(v);
}

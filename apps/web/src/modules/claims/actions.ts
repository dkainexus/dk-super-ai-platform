"use server";

// Theft claims: record, confirm the computed compensation, blacklist the
// company, recover from the agent. The owner's rent is never touched.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { money, rentRefund, setupFeeRefund, lastOfMonth } from "@/modules/billing/engine";
import { buildClaimContext, claim as loadClaim } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate(id?: string) {
  revalidatePath("/admin/compensation");
  if (id) revalidatePath(`/admin/compensation/${id}`);
}

export async function createClaim(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("claims", "add");
  const back = "/admin/compensation";
  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  const amount = parseFloat(String(formData.get("amount") ?? "").replace(/,/g, ""));
  if (!bankAccountId) fail(back, "Pick the account the money was taken from");
  if (!Number.isFinite(amount) || amount <= 0) fail(back, "Enter the stolen amount");

  const { data: acc } = await db()
    .from("bank_accounts")
    .select("id, merchant_id, country_id")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (!acc) fail(back, "Account not found");

  const { data, error } = await db()
    .from("claims")
    .insert({
      merchant_id: acc.merchant_id,
      country_id: acc.country_id,
      bank_account_id: bankAccountId,
      amount,
      description: String(formData.get("description") ?? "").trim() || null,
      created_by: cu.user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to record: ${error?.message}`);
  revalidate();
  redirect(`/admin/compensation/${data.id}`);
}

/**
 * Commit the computation as shown: credit the customer, debit the agent. The
 * numbers are stored on the claim so the record shows what was decided.
 */
export async function confirmClaim(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("claims", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/compensation/${id}`;

  const c = await loadClaim(id);
  if (!c) fail(back, "Case not found");
  if (c.status !== "open") fail(back, "Already confirmed");

  const ctx = await buildClaimContext(c);
  const comp = ctx.computation;

  // The customer's compensation and refunds arrive as wallet credit — it
  // offsets their next invoices, and with nothing to offset it is withdrawable.
  if (ctx.customer) {
    const credit = money(comp.customer_compensation + comp.customer_setup_fee_refund);
    if (credit > 0) {
      await db().from("ledger_entries").insert({
        merchant_id: c.merchant_id,
        country_id: c.country_id,
        holder_type: "customer",
        holder_id: ctx.customer.id,
        currency: "THB",
        amount: credit,
        kind: "adjustment",
        note: `Theft compensation ${c.ref ?? c.id} (capped at deposit${
          comp.customer_setup_fee_refund > 0 ? " + setup fee refund" : ""
        })`,
        created_by: cu.user.id,
      });
    }
  }

  // What the agent owes sits as a negative balance; every future payout run
  // deducts from it until it is gone. Their owners' rent is untouched.
  if (ctx.agent && comp.agent_total_due > 0) {
    await db().from("ledger_entries").insert({
      merchant_id: c.merchant_id,
      country_id: c.country_id,
      holder_type: "agent",
      holder_id: ctx.agent.id,
      currency: "THB",
      amount: -comp.agent_total_due,
      kind: "adjustment",
      note: `Theft recovery ${c.ref ?? c.id}: deposit ${comp.agent_deposit_due}${
        comp.inside_agent_window
          ? ` + company ${comp.agent_company_due} + rent paid ${comp.agent_rent_due}`
          : ""
      }`,
      created_by: cu.user.id,
    });
  }

  await db()
    .from("claims")
    .update({
      status: "confirmed",
      computation: comp,
      customer_compensation: comp.customer_compensation,
      agent_recovery: comp.agent_total_due,
      confirmed_by: cu.user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidate(id);
  redirect(`${back}?saved=confirmed`);
}

/**
 * The company is burned: every account under it suspends and freezes, and the
 * innocent customers renting them are terminated with their unused money back.
 */
export async function blacklistCompany(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("claims", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/compensation/${id}`;
  const today = new Date().toISOString().slice(0, 10);

  const c = await loadClaim(id);
  if (!c) fail(back, "Case not found");
  const companyId = c.bank_account?.company_id;
  if (!companyId) fail(back, "The account has no company to blacklist");

  await db().from("companies").update({ status: "banned" }).eq("id", companyId);

  const { data: accounts } = await db().from("bank_accounts").select("id").eq("company_id", companyId);
  const accountIds = ((accounts ?? []) as { id: string }[]).map((a) => a.id);
  await db()
    .from("bank_accounts")
    .update({
      status: "suspended",
      suspended_at: new Date().toISOString(),
      billing_frozen: true,
      frozen_at: new Date().toISOString(),
      frozen_reason: `Company blacklisted (compensation ${c.ref ?? c.id})`,
    })
    .in("id", accountIds);

  // Innocent customers: their lines end today, unused rent comes back, and a
  // setup fee still inside its 30 days comes back prorated.
  const { data: lines } = await db()
    .from("contract_accounts")
    .select(
      "id, starts_on, ends_on, setup_fee, contract:contracts!inner(id, party_type, customer_id, merchant_id, country_id), contract_terms(*)"
    )
    .in("bank_account_id", accountIds)
    .is("ends_on", null);

  let refunded = 0;
  for (const l of (lines ?? []) as unknown as {
    id: string;
    starts_on: string | null;
    setup_fee: number;
    contract: { party_type: string; customer_id: string | null; merchant_id: string; country_id: string | null };
    contract_terms: { base_rent: number; effective_from: string; effective_to: string | null }[];
  }[]) {
    await db().from("contract_accounts").update({ ends_on: today }).eq("id", l.id);
    if (l.contract.party_type !== "customer" || !l.contract.customer_id) continue;

    const terms = l.contract_terms
      .filter((t) => t.effective_from <= today && (!t.effective_to || t.effective_to >= today))
      .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
    const base = Number(terms?.base_rent ?? 0);
    // This month was billed in advance; the rest of it is now unused.
    const rentBack = rentRefund(base, today, lastOfMonth(today));
    const feeBack = l.starts_on ? setupFeeRefund(Number(l.setup_fee), l.starts_on, today) : 0;
    const credit = money(rentBack + feeBack);
    if (credit > 0) {
      refunded++;
      await db().from("ledger_entries").insert({
        merchant_id: l.contract.merchant_id,
        country_id: l.contract.country_id,
        holder_type: "customer",
        holder_id: l.contract.customer_id,
        currency: "THB",
        amount: credit,
        kind: "adjustment",
        note: `Refund — company blacklisted (compensation ${c.ref ?? c.id}): unused rent ${rentBack}${
          feeBack > 0 ? ` + setup fee ${feeBack}` : ""
        }`,
        created_by: cu.user.id,
      });
    }
  }

  revalidate(id);
  redirect(`${back}?saved=blacklisted&refunded=${refunded}`);
}

export async function closeClaim(formData: FormData): Promise<void> {
  await requirePerm("claims", "edit");
  const id = String(formData.get("id") ?? "");
  await db()
    .from("claims")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "confirmed");
  revalidate(id);
  redirect(`/admin/compensation/${id}`);
}

"use server";

// Billing actions: the monthly run and the life of an invoice.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { buildDraft, issueRun } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

const monthOf = (formData: FormData): string => {
  const raw = String(formData.get("month") ?? ""); // YYYY-MM from <input type=month>
  if (!/^\d{4}-\d{2}$/.test(raw)) fail("/admin/billing", "Pick the month to run");
  return `${raw}-01`;
};

/** Generate (or regenerate) the draft — this is both buttons in one action. */
export async function generateDraft(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "add");
  if (cu.merchant) redirect("/m");
  const month = monthOf(formData);
  const back = `/admin/billing?month=${month.slice(0, 7)}`;

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;
  if (!active) fail("/admin/billing", "Switch into a country first");

  try {
    await buildDraft(active.id, month, cu.user.id);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "The draft could not be built");
  }
  revalidatePath("/admin/billing");
  redirect(back);
}

export async function discardDraft(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const runId = String(formData.get("run_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing");

  const { data: run } = await db().from("billing_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) fail(back, "Run not found");
  if (run.status !== "draft") fail(back, "Only a draft can be discarded");

  await db().from("invoices").delete().eq("run_id", runId).eq("status", "draft");
  await db().from("billing_runs").delete().eq("id", runId);
  revalidatePath("/admin/billing");
  redirect(back);
}

/** The point of no return: drafts become real invoices and payouts. */
export async function approveAndIssue(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const runId = String(formData.get("run_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing");

  const { data: run } = await db().from("billing_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) fail(back, "Run not found");
  if (run.status !== "draft") fail(back, "This run has already been issued");

  const count = await issueRun(runId, cu.user.id);
  revalidatePath("/admin/billing");
  redirect(`${back}${back.includes("?") ? "&" : "?"}issued=${count}`);
}

export async function markInvoicePaid(formData: FormData): Promise<void> {
  await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/billing/invoices/${id}`);

  const { data } = await db().from("invoices").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Invoice not found");
  if (data.status !== "issued") fail(back, "Only an issued invoice can be marked paid");

  await db().from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/billing");
  redirect(back);
}

/**
 * Cancel an issued invoice. Its lines keep their dedupe keys on record, so the
 * next Recalculate raises the replacement — cancel, fix the terms, re-run.
 */
export async function cancelInvoice(formData: FormData): Promise<void> {
  await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/billing/invoices/${id}`);

  const { data } = await db().from("invoices").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Invoice not found");
  if (data.status === "paid") fail(back, "A paid invoice cannot be cancelled");

  await db().from("invoices").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
  // Freeing the keys is what lets the replacement be raised.
  await db().from("invoice_lines").delete().eq("invoice_id", id);
  revalidatePath("/admin/billing");
  redirect(back);
}

// ---------- Turnover review ----------

export async function reviewTurnover(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing/turnover");

  const { data } = await db().from("turnover_declarations").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Declaration not found");
  if (data.status !== "pending") fail(back, "Already reviewed");

  if (decision === "approve") {
    await db()
      .from("turnover_declarations")
      .update({ status: "approved", reviewed_by: cu.user.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) fail(back, "Say why it is rejected — the customer resubmits against this");
    await db()
      .from("turnover_declarations")
      .update({
        status: "rejected",
        reject_reason: reason,
        reviewed_by: cu.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
  revalidatePath("/admin/billing/turnover");
  redirect(back);
}

// ---------- Wallets ----------

/** We received USDT from a customer; their ledger is credited in the country's currency. */
export async function recordTopUp(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  const customerId = String(formData.get("customer_id") ?? "");
  const back = String(formData.get("back") ?? `/admin/customers/${customerId}`);
  const usdt = parseFloat(String(formData.get("usdt_amount") ?? ""));
  if (!Number.isFinite(usdt) || usdt <= 0) fail(back, "Enter the USDT amount received");

  const { data: customer } = await db()
    .from("customers")
    .select("id, merchant_id, country_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) fail(back, "Customer not found");

  const { data: country } = await db()
    .from("countries")
    .select("currency, usdt_markup_pct, usdt_markup_flat")
    .eq("id", customer.country_id ?? "")
    .maybeSingle();
  if (!country) fail(back, "The customer has no country to price against");

  const { effectiveRates } = await import("./fx");
  let rates;
  try {
    rates = await effectiveRates(country as { currency: string; usdt_markup_pct: number; usdt_markup_flat: number });
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "No USDT rate available");
  }

  const credited = Math.round(usdt * rates.receivable * 100) / 100;
  const { error } = await db().from("ledger_entries").insert({
    merchant_id: customer.merchant_id,
    country_id: customer.country_id,
    holder_type: "customer",
    holder_id: customer.id,
    currency: country.currency,
    amount: credited,
    kind: "topup",
    usdt_amount: usdt,
    usdt_rate: rates.receivable,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: cu.user.id,
  });
  if (error) fail(back, `Failed to record: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=topup`);
}

/** Pay an issued receivable from the customer's ledger balance. */
export async function settleFromWallet(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/billing/invoices/${id}`);

  const { data } = await db().from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) fail(back, "Invoice not found");
  const inv = data as {
    id: string; status: string; direction: string; total: number; currency: string;
    customer_id: string | null; merchant_id: string; country_id: string | null; ref: string | null;
  };
  if (inv.status !== "issued") fail(back, "Only an issued invoice can be settled");
  if (inv.direction !== "receivable" || !inv.customer_id) fail(back, "Only customer invoices settle from a wallet");

  const { ledgerFor } = await import("./ledger");
  const { balance } = await ledgerFor("customer", inv.customer_id);
  if (balance < Number(inv.total))
    fail(back, `The wallet holds ${balance.toLocaleString()} — not enough for this invoice`);

  const { error } = await db().from("ledger_entries").insert({
    merchant_id: inv.merchant_id,
    country_id: inv.country_id,
    holder_type: "customer",
    holder_id: inv.customer_id,
    currency: inv.currency,
    amount: -Number(inv.total),
    kind: "invoice_payment",
    invoice_id: inv.id,
    note: inv.ref,
    created_by: cu.user.id,
  });
  if (error) fail(back, `Failed to settle: ${error.message}`);

  await db().from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/billing");
  redirect(back);
}

// ---------- White-label settlement ----------

/** Lock a month's statement and credit the white label's wallet with the net. */
export async function approveSettlement(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const month = String(formData.get("period_month") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing/settlements");

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;
  if (!active) fail(back, "Switch into a country first");

  const { computeSettlements } = await import("./settlement");
  const statements = await computeSettlements(active.id, month);
  const statement = statements.find((s) => s.merchant_id === merchantId);
  if (!statement) fail(back, "Nothing to settle for that white label this month");
  if (statement.accounts.some((a) => a.warning))
    fail(back, "Fix the accounts missing an asking price first");

  const { error } = await db().from("settlements").insert({
    merchant_id: merchantId,
    country_id: active.id,
    period_month: month,
    computation: statement,
    net_amount: statement.wl_net,
    approved_by: cu.user.id,
  });
  if (error)
    fail(back, error.message.includes("duplicate") ? "That month is already settled" : `Failed: ${error.message}`);

  if (statement.wl_net !== 0) {
    await db().from("ledger_entries").insert({
      merchant_id: merchantId,
      country_id: active.id,
      holder_type: "merchant",
      holder_id: merchantId,
      currency: active.currency,
      amount: statement.wl_net,
      kind: "payout",
      note: `Settlement ${month.slice(0, 7)}`,
      created_by: cu.user.id,
    });
  }
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/** We received the white label's USDT top-up (company funding money). */
export async function recordMerchantTopUp(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = String(formData.get("back") ?? `/admin/white-labels/${merchantId}`);
  const amount = parseFloat(String(formData.get("amount") ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) fail(back, "Enter the amount received");

  await db().from("ledger_entries").insert({
    merchant_id: merchantId,
    holder_type: "merchant",
    holder_id: merchantId,
    currency: "THB",
    amount,
    kind: "topup",
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: cu.user.id,
  });
  revalidatePath(back);
  redirect(`${back}?saved=topup`);
}

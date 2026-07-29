"use server";

// Contracts module actions. Terms are never edited in place — a change closes
// the old version and opens a new one, so history always explains old invoices.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { addDays, addMonths, firstOfMonth } from "@/modules/billing/engine";
import { activationDates, renewalState, today, type Contract } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate(id?: string) {
  revalidatePath("/admin/contracts");
  if (id) revalidatePath(`/admin/contracts/${id}`);
}

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};
const int = (v: FormDataEntryValue | null, fallback: number) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

export async function createContract(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "add");
  const back = "/admin/contracts/new";

  const partyType = String(formData.get("party_type") ?? "");
  if (!["customer", "agent", "owner"].includes(partyType)) fail(back, "Pick who the contract is with");
  const partyId = String(formData.get("party_id") ?? "");
  if (!partyId) fail(back, "Pick the party");

  // The party fixes the white label; the country is the one being worked in.
  const table = partyType === "customer" ? "customers" : partyType === "agent" ? "agents" : "owners";
  const { data: party } = await db().from(table).select("id, merchant_id").eq("id", partyId).maybeSingle();
  if (!party) fail(back, "That party no longer exists");

  const { adminCountry } = await import("@/modules/countries/lib");
  const countryId = (await adminCountry()).active?.id ?? null;

  const { data, error } = await db()
    .from("contracts")
    .insert({
      merchant_id: party.merchant_id,
      country_id: countryId,
      party_type: partyType,
      customer_id: partyType === "customer" ? partyId : null,
      agent_id: partyType === "agent" ? partyId : null,
      owner_id: partyType === "owner" ? partyId : null,
      min_term_months: Math.max(1, int(formData.get("min_term_months"), 3)),
      renewal_min_months: Math.max(1, int(formData.get("renewal_min_months"), 3)),
      renewal_window_days: Math.max(1, int(formData.get("renewal_window_days"), 30)),
      lead_days: Math.max(0, int(formData.get("lead_days"), 14)),
      deposit: num(formData.get("deposit")),
      theft_window_months: partyType === "agent" ? int(formData.get("theft_window_months"), 6) : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: cu.user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);

  revalidate();
  redirect(`/admin/contracts/${data.id}`);
}

export async function updateContract(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/contracts/${id}`;

  const { data: existing } = await db().from("contracts").select("party_type, status").eq("id", id).maybeSingle();
  if (!existing) fail(back, "Contract not found");

  const { error } = await db()
    .from("contracts")
    .update({
      min_term_months: Math.max(1, int(formData.get("min_term_months"), 3)),
      renewal_min_months: Math.max(1, int(formData.get("renewal_min_months"), 3)),
      renewal_window_days: Math.max(1, int(formData.get("renewal_window_days"), 30)),
      lead_days: Math.max(0, int(formData.get("lead_days"), 14)),
      deposit: num(formData.get("deposit")),
      theft_window_months:
        existing.party_type === "agent" ? int(formData.get("theft_window_months"), 6) : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidate(id);
  redirect(back);
}

/** Add an account to the contract, with its first version of terms. */
export async function addContractAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const contractId = String(formData.get("contract_id") ?? "");
  const back = `/admin/contracts/${contractId}`;
  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  if (!bankAccountId) fail(back, "Pick the account");

  const { data: c } = await db().from("contracts").select("*").eq("id", contractId).maybeSingle();
  if (!c) fail(back, "Contract not found");
  const startsOn = String(formData.get("starts_on") ?? "") || addDays(today(), (c as Contract).lead_days);

  const { data: line, error } = await db()
    .from("contract_accounts")
    .insert({
      contract_id: contractId,
      bank_account_id: bankAccountId,
      starts_on: startsOn,
      setup_fee: num(formData.get("setup_fee")),
      created_by: cu.user.id,
    })
    .select("id")
    .single();
  if (error || !line)
    fail(back, error?.message.includes("duplicate") ? "That account is already on this contract" : `Failed: ${error?.message}`);

  const { error: termsError } = await db().from("contract_terms").insert({
    contract_account_id: line.id,
    base_rent: num(formData.get("base_rent")),
    turnover_rate: String(formData.get("turnover_rate") ?? "").trim()
      ? num(formData.get("turnover_rate"))
      : null,
    effective_from: startsOn,
    created_by: cu.user.id,
  });
  if (termsError) fail(back, `Account added but the terms failed: ${termsError.message}`);

  revalidate(contractId);
  redirect(back);
}

/**
 * Change an account's terms: the old version closes at the end of this month
 * and the new one takes effect from the 1st of the next, so no month is ever
 * billed at two prices.
 */
export async function changeTerms(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const contractId = String(formData.get("contract_id") ?? "");
  const lineId = String(formData.get("contract_account_id") ?? "");
  const back = `/admin/contracts/${contractId}`;

  const effectiveFrom = firstOfMonth(addMonths(today(), 1));
  const { data: current } = await db()
    .from("contract_terms")
    .select("id, effective_from")
    .eq("contract_account_id", lineId)
    .is("effective_to", null)
    .maybeSingle();

  if (current) {
    if (current.effective_from >= effectiveFrom) {
      // Editing a version that has not started yet just replaces it.
      await db().from("contract_terms").delete().eq("id", current.id);
    } else {
      await db()
        .from("contract_terms")
        .update({ effective_to: addDays(effectiveFrom, -1) })
        .eq("id", current.id);
    }
  }

  const { error } = await db().from("contract_terms").insert({
    contract_account_id: lineId,
    base_rent: num(formData.get("base_rent")),
    turnover_rate: String(formData.get("turnover_rate") ?? "").trim()
      ? num(formData.get("turnover_rate"))
      : null,
    effective_from: effectiveFrom,
    created_by: cu.user.id,
  });
  if (error) fail(back, `Failed to save the new terms: ${error.message}`);

  revalidate(contractId);
  redirect(`${back}?saved=terms`);
}

/** Bring an account's billing start forward — the customer confirmed early. */
export async function startAccountEarly(formData: FormData): Promise<void> {
  await requirePerm("contracts", "edit");
  const contractId = String(formData.get("contract_id") ?? "");
  const lineId = String(formData.get("contract_account_id") ?? "");
  const back = `/admin/contracts/${contractId}`;
  const startsOn = String(formData.get("starts_on") ?? "");
  if (!startsOn) fail(back, "Pick the start date");

  const { data: line } = await db()
    .from("contract_accounts")
    .select("id, setup_fee_invoiced_at")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) fail(back, "Account line not found");
  if (line.setup_fee_invoiced_at) fail(back, "This account has already been billed — its start cannot move");

  await db().from("contract_accounts").update({ starts_on: startsOn }).eq("id", lineId);
  // The first terms version starts when billing does.
  const { data: first } = await db()
    .from("contract_terms")
    .select("id")
    .eq("contract_account_id", lineId)
    .order("effective_from")
    .limit(1)
    .maybeSingle();
  if (first) await db().from("contract_terms").update({ effective_from: startsOn }).eq("id", first.id);

  revalidate(contractId);
  redirect(back);
}

export async function removeContractAccount(formData: FormData): Promise<void> {
  await requirePerm("contracts", "edit");
  const contractId = String(formData.get("contract_id") ?? "");
  const lineId = String(formData.get("contract_account_id") ?? "");
  const back = `/admin/contracts/${contractId}`;

  const { data: line } = await db()
    .from("contract_accounts")
    .select("setup_fee_invoiced_at")
    .eq("id", lineId)
    .maybeSingle();
  if (line?.setup_fee_invoiced_at)
    fail(back, "This account has been billed — end it with a date instead of removing it");

  const { count } = await db()
    .from("invoice_lines")
    .select("id", { count: "exact", head: true })
    .eq("contract_account_id", lineId);
  if ((count ?? 0) > 0) fail(back, "This account appears on invoices — end it with a date instead");

  await db().from("contract_accounts").delete().eq("id", lineId);
  revalidate(contractId);
  redirect(back);
}

/** An account leaves the contract on a chosen day; billing prorates to it. */
export async function endContractAccount(formData: FormData): Promise<void> {
  await requirePerm("contracts", "edit");
  const contractId = String(formData.get("contract_id") ?? "");
  const lineId = String(formData.get("contract_account_id") ?? "");
  const back = `/admin/contracts/${contractId}`;
  const endsOn = String(formData.get("ends_on") ?? "") || today();

  await db().from("contract_accounts").update({ ends_on: endsOn }).eq("id", lineId);
  revalidate(contractId);
  redirect(back);
}

/** Fix the term from the earliest account start and make the contract live. */
export async function activateContract(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/contracts/${id}`;

  const { data: c } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c) fail(back, "Contract not found");
  if (c.status !== "draft") fail(back, "Only a draft can be activated");

  const { data: lines } = await db().from("contract_accounts").select("starts_on").eq("contract_id", id);
  const starts = ((lines ?? []) as { starts_on: string | null }[])
    .map((l) => l.starts_on)
    .filter((s): s is string => Boolean(s));
  const dates = activationDates(starts, (c as Contract).min_term_months);
  if (!dates) fail(back, "Add at least one account before activating");

  await db()
    .from("contracts")
    .update({ ...dates, status: "active", updated_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", id);
  revalidate(id);
  redirect(`${back}?saved=active`);
}

/**
 * Renew: extend the end by at least the renewal minimum. Inside the window it
 * is routine; after the window only a platform admin can do it, by agreement.
 */
export async function renewContract(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/contracts/${id}`;
  const months = Math.max(1, int(formData.get("months"), 3));

  const { data } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!data) fail(back, "Contract not found");
  const c = data as Contract;
  if (!c.ends_on) fail(back, "This contract has no end date to extend");
  if (months < c.renewal_min_months) fail(back, `Renewal is at least ${c.renewal_min_months} months`);

  const state = renewalState(c, today());
  if (state === "not_yet") fail(back, "The renewal window has not opened yet");
  if (state === "closed" && cu.merchant) fail(back, "The window has closed — renewal is now by agreement with the platform");

  await db()
    .from("contracts")
    .update({
      ends_on: addDays(addMonths(firstOfMonth(addMonths(c.ends_on, 1)), months), -1),
      status: "active",
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id);
  revalidate(id);
  redirect(`${back}?saved=renewed`);
}

/** Terminate: the contract and every account on it stop on the chosen day. */
export async function terminateContract(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/contracts/${id}`;
  const endsOn = String(formData.get("ends_on") ?? "") || today();

  await db()
    .from("contracts")
    .update({
      status: "terminated",
      ends_on: endsOn,
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id);
  await db()
    .from("contract_accounts")
    .update({ ends_on: endsOn })
    .eq("contract_id", id)
    .is("ends_on", null);
  revalidate(id);
  redirect(back);
}

export async function deleteContract(formData: FormData): Promise<void> {
  await requirePerm("contracts", "delete");
  const id = String(formData.get("id") ?? "");
  const { data } = await db().from("contracts").select("status").eq("id", id).maybeSingle();
  if (data && data.status !== "draft")
    fail(`/admin/contracts/${id}`, "Only a draft can be deleted — terminate a live contract instead");
  await db().from("contracts").delete().eq("id", id);
  revalidate();
  redirect("/admin/contracts");
}

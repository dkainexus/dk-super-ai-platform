"use server";

// Contract Policy actions: the owner guardrails, agent and customer condition
// tables (templates and per-person copies), the versioned T&C text, and the
// assignment lifecycle.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { copyTemplateToAgent, enabledChannelNames } from "./policy";
import { copyTemplateToCustomer, customerConditionRows, currentTnc, goLive, assignmentDeadline } from "./customer-policy";
import { addDays } from "@/modules/billing/engine";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
};
const int = (v: FormDataEntryValue | null): number | null => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Resolve who may touch which merchant/country, from either side (agent kind). */
async function scopeOf(formData: FormData) {
  const { cu } = await requirePerm("contracts", "edit");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/contract-policy" : "/admin/contracts"));
  let merchantId: string;
  let countryId: string;
  if (cu.merchant) {
    merchantId = cu.merchant.id;
    const { activeCountry } = await import("@/modules/merchants/lib");
    const active = (await activeCountry(cu as Parameters<typeof activeCountry>[0])).active;
    if (!active) fail(back, "No active country");
    countryId = active.id;
  } else {
    merchantId = String(formData.get("merchant_id") ?? "");
    countryId = String(formData.get("country_id") ?? "");
    if (!merchantId || !countryId) fail(back, "Missing white label or country");
  }
  return { cu, back, merchantId, countryId };
}

/** Customer kind is platform-side only for now (WL customer templates come later). */
async function customerScopeOf(formData: FormData) {
  const { cu } = await requirePerm("contracts", "edit");
  if (cu.merchant) fail("/m", "Customer conditions are managed by the platform");
  const back = String(formData.get("back") ?? "/admin/contracts/customer-defaults");
  const countryId = String(formData.get("country_id") ?? "");
  if (!countryId) fail(back, "Missing country");
  const customerId = String(formData.get("customer_id") ?? "") || null;
  return { cu, back, countryId, customerId };
}

export async function savePolicy(formData: FormData): Promise<void> {
  const { cu, back, merchantId, countryId } = await scopeOf(formData);
  const patch = {
    merchant_id: merchantId,
    country_id: countryId,
    owner_rent_min: num(formData.get("owner_rent_min")),
    owner_rent_max: num(formData.get("owner_rent_max")),
    owner_min_contract_months: int(formData.get("owner_min_contract_months")) ?? 6,
    owner_min_renewal_months: int(formData.get("owner_min_renewal_months")) ?? 3,
    updated_by: cu.user.id,
    updated_at: new Date().toISOString(),
  };
  if (patch.owner_rent_max > 0 && patch.owner_rent_max < patch.owner_rent_min)
    fail(back, "The rent maximum is below the minimum");
  const { error } = await db()
    .from("contract_policies")
    .upsert(patch, { onConflict: "merchant_id,country_id" });
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=policy`);
}

/** A guard so merchant users can only touch their own rows and agents. */
async function guardAgent(merchantId: string, agentId: string | null, back: string) {
  if (!agentId) return;
  const { data } = await db().from("agents").select("id").eq("id", agentId).eq("merchant_id", merchantId).maybeSingle();
  if (!data) fail(back, "Not your agent");
}

function readRowFields(formData: FormData, back: string, withDeposit: boolean) {
  const bankId = String(formData.get("bank_id") ?? "");
  if (!bankId) fail(back, "Pick the bank");
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const modeRaw = String(formData.get("mode") ?? "rent");
  const mode = ["rent", "turnover", "rent_plus_turnover", "max"].includes(modeRaw) ? modeRaw : "rent";
  const rent = num(formData.get("rent"));
  const pct = num(formData.get("turnover_pct"));
  const contractMonths = mode === "turnover" ? null : int(formData.get("contract_months"));
  const renewalMonths = mode === "turnover" ? null : int(formData.get("renewal_months"));
  const deposit = withDeposit ? num(formData.get("deposit")) : 0;

  if (mode !== "turnover" && rent <= 0) fail(back, "This mode needs an amount");
  if (mode !== "rent" && pct <= 0) fail(back, "This mode needs a turnover %");
  if (mode !== "turnover" && !contractMonths) fail(back, "This mode needs contract months");

  return {
    bank_id: bankId,
    channel,
    mode,
    rent: mode === "turnover" ? 0 : rent,
    turnover_pct: mode === "rent" ? null : pct,
    contract_months: contractMonths,
    renewal_months: renewalMonths,
    ...(withDeposit ? { deposit } : {}),
  };
}

export async function saveConditionRow(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "agent");
  const id = String(formData.get("row_id") ?? "") || null;

  if (kind === "customer") {
    const { cu, back, countryId, customerId } = await customerScopeOf(formData);
    const fields = readRowFields(formData, back, false);

    let merchantId: string | null = null;
    if (customerId) {
      const { data: c } = await db().from("customers").select("merchant_id").eq("id", customerId).maybeSingle();
      if (!c) fail(back, "Customer not found");
      merchantId = c.merchant_id as string;
    }

    let clash = db()
      .from("customer_condition_rows")
      .select("id")
      .eq("country_id", countryId)
      .eq("bank_id", fields.bank_id);
    clash = customerId ? clash.eq("customer_id", customerId) : clash.is("customer_id", null).is("merchant_id", null);
    clash = fields.channel ? clash.eq("channel", fields.channel) : clash.is("channel", null);
    const { data: existing } = await clash.maybeSingle();
    if (existing && existing.id !== id)
      fail(back, fields.channel ? `There is already a row for this bank × ${fields.channel}` : "This bank already has a default row");

    const row = { country_id: countryId, merchant_id: merchantId, customer_id: customerId, ...fields };
    const { error } = id
      ? await db().from("customer_condition_rows").update(row).eq("id", id)
      : await db().from("customer_condition_rows").insert({ ...row, created_by: cu.user.id });
    if (error) fail(back, `Failed to save: ${error.message}`);
    revalidatePath(back);
    redirect(`${back}?saved=row`);
  }

  const { cu, back, merchantId, countryId } = await scopeOf(formData);
  const agentId = String(formData.get("agent_id") ?? "") || null;
  await guardAgent(merchantId, agentId, back);
  const fields = readRowFields(formData, back, true);

  let clash = db()
    .from("agent_condition_rows")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .eq("bank_id", fields.bank_id);
  clash = agentId ? clash.eq("agent_id", agentId) : clash.is("agent_id", null);
  clash = fields.channel ? clash.eq("channel", fields.channel) : clash.is("channel", null);
  const { data: existing } = await clash.maybeSingle();
  if (existing && existing.id !== id)
    fail(back, fields.channel ? `There is already a row for this bank × ${fields.channel}` : "This bank already has a default row");

  const row = { merchant_id: merchantId, country_id: countryId, agent_id: agentId, ...fields };
  const { error } = id
    ? await db().from("agent_condition_rows").update(row).eq("id", id).eq("merchant_id", merchantId)
    : await db().from("agent_condition_rows").insert({ ...row, created_by: cu.user.id });
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=row`);
}

export async function deleteConditionRow(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "agent");
  const id = String(formData.get("row_id") ?? "");
  if (kind === "customer") {
    const { back } = await customerScopeOf(formData);
    await db().from("customer_condition_rows").delete().eq("id", id);
    revalidatePath(back);
    redirect(back);
  }
  const { back, merchantId } = await scopeOf(formData);
  await db().from("agent_condition_rows").delete().eq("id", id).eq("merchant_id", merchantId);
  revalidatePath(back);
  redirect(back);
}

export async function copyTemplateAction(formData: FormData): Promise<void> {
  const kind = String(formData.get("kind") ?? "agent");
  if (kind === "customer") {
    const { cu, back, countryId, customerId } = await customerScopeOf(formData);
    if (!customerId) fail(back, "Missing customer");
    const { data: c } = await db().from("customers").select("merchant_id").eq("id", customerId).maybeSingle();
    if (!c) fail(back, "Customer not found");
    const copied = await copyTemplateToCustomer(countryId, customerId, c.merchant_id as string, cu.user.id);
    revalidatePath(back);
    redirect(`${back}?saved=copied&count=${copied}`);
  }
  const { cu, back, merchantId, countryId } = await scopeOf(formData);
  const agentId = String(formData.get("agent_id") ?? "");
  if (!agentId) fail(back, "Missing agent");
  await guardAgent(merchantId, agentId, back);
  const copied = await copyTemplateToAgent(merchantId, countryId, agentId, cu.user.id);
  revalidatePath(back);
  redirect(`${back}?saved=copied&count=${copied}`);
}

// ---------- terms & conditions ----------

/** Publishing is adding a version — nothing is ever edited or deleted. */
export async function publishTnc(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  if (cu.merchant) fail("/m", "Platform terms are managed by the platform");
  const back = "/admin/contracts/terms";
  const countryId = String(formData.get("country_id") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Terms & Conditions";
  const body = String(formData.get("body") ?? "").trim();
  if (!countryId) fail(back, "Missing country");
  if (body.length < 20) fail(back, "The terms text looks empty");

  const { data: latest } = await db()
    .from("terms_documents")
    .select("version")
    .eq("country_id", countryId)
    .is("merchant_id", null)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((latest ?? [])[0]?.version ?? 0) + 1;
  const { error } = await db().from("terms_documents").insert({
    country_id: countryId,
    version,
    title,
    body,
    created_by: cu.user.id,
  });
  if (error) fail(back, `Failed to publish: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=v${version}`);
}

// ---------- assignments ----------

/**
 * Offer an account to a customer at their own conditions for its bank and
 * channel. Everything the customer will confirm — the conditions and the T&C
 * version — freezes here.
 */
export async function assignAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  if (cu.merchant) fail("/m", "Assignment is a platform operation");
  const accountId = String(formData.get("bank_account_id") ?? "");
  const back = String(formData.get("back") ?? `/admin/bank-accounts/${accountId}`);
  const customerId = String(formData.get("customer_id") ?? "");
  const deliveryRaw = String(formData.get("delivery_method") ?? "direct");
  const delivery = deliveryRaw === "shipping" ? "shipping" : "direct";
  if (!customerId) fail(back, "Pick the customer");

  const { data: acc } = await db()
    .from("bank_accounts")
    .select("id, merchant_id, country_id, bank_id, channels, status, bank:banks(name)")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) fail(back, "Account not found");
  if (acc.status !== "active") fail(back, "Only an active account can be assigned");

  const { data: customer } = await db()
    .from("customers")
    .select("id, name, status, country_id, deposit, setup_fee")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer || customer.status !== "active") fail(back, "Customer not found or suspended");

  const rows = await customerConditionRows(acc.country_id ?? "", customerId);
  const bankName = (acc.bank as { name?: string } | null)?.name ?? "this bank";
  const channels = enabledChannelNames(acc.channels);
  const row =
    rows.find((r) => r.bank_id === acc.bank_id && r.channel != null && channels.includes(r.channel)) ??
    rows.find((r) => r.bank_id === acc.bank_id && r.channel == null) ??
    null;
  if (!row) fail(back, `${customer.name} has no conditions for ${bankName} — set them on the customer's page first`);

  const tnc = await currentTnc(acc.country_id ?? "", null);
  if (!tnc) fail(back, "Publish the Terms & Conditions for this country first — the customer must have something to read");

  const { error } = await db().from("account_assignments").insert({
    merchant_id: acc.merchant_id,
    country_id: acc.country_id,
    bank_account_id: accountId,
    customer_id: customerId,
    delivery_method: delivery,
    conditions: {
      bank: bankName,
      channel: row.channel,
      mode: row.mode,
      rent: Number(row.rent),
      turnover_pct: row.turnover_pct == null ? null : Number(row.turnover_pct),
      // Insurance and the setup fee are the customer's own, not the row's.
      setup_fee: Number((customer as { setup_fee?: number }).setup_fee ?? 0),
      deposit: Number((customer as { deposit?: number }).deposit ?? 0),
      contract_months: row.contract_months,
      renewal_months: row.renewal_months,
    },
    tnc_id: tnc.id,
    created_by: cu.user.id,
  });
  if (error)
    fail(
      back,
      /duplicate|unique/i.test(error.message)
        ? "This account already has an open assignment"
        : `Failed to assign: ${error.message}`
    );
  revalidatePath(back);
  redirect(`${back}?saved=assigned`);
}

export async function setAssignmentDelivery(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/contracts/assignments");
  const delivery = String(formData.get("delivery_method") ?? "") === "shipping" ? "shipping" : "direct";
  await db()
    .from("account_assignments")
    .update({ delivery_method: delivery, updated_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", id)
    .neq("status", "live")
    .neq("status", "cancelled");
  revalidatePath(back);
  redirect(back);
}

export async function cancelAssignment(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/contracts/assignments");
  const { data } = await db().from("account_assignments").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Assignment not found");
  if (data.status === "live") fail(back, "A live assignment is a running contract — terminate the contract instead");
  await db()
    .from("account_assignments")
    .update({
      status: "cancelled",
      cancel_reason: String(formData.get("reason") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id);
  revalidatePath(back);
  redirect(back);
}

/**
 * The binding or delivery finished today — billing starts tomorrow, capped at
 * 14 days from assignment.
 */
export async function markAssignmentReady(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/contracts/assignments");
  const { data } = await db().from("account_assignments").select("status, confirmed_at").eq("id", id).maybeSingle();
  if (!data) fail(back, "Assignment not found");
  if (data.status === "awaiting_confirmation")
    fail(back, "The customer hasn't confirmed the agreement yet");
  const today = new Date().toISOString().slice(0, 10);
  const err = await goLive(id, addDays(today, 1), cu.user.id);
  if (err) fail(back, err);
  revalidatePath(back);
  redirect(`${back}?saved=live`);
}

/** The white label's renewal switches: auto, or manual — meaning we confirm. */
export async function saveRenewModes(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  if (!cu.merchant) fail("/admin", "Set on the white label's own console");
  const back = "/m/contract-policy";
  const mode = (v: FormDataEntryValue | null) => (String(v ?? "auto") === "manual" ? "manual" : "auto");
  const { error } = await db()
    .from("merchants")
    .update({
      renew_owner_mode: mode(formData.get("renew_owner_mode")),
      renew_agent_mode: mode(formData.get("renew_agent_mode")),
    })
    .eq("id", cu.merchant.id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=renew`);
}

// ---------- termination requests ----------

export async function decideTermination(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  if (cu.merchant) fail("/m", "Terminations are decided by the platform");
  const id = String(formData.get("id") ?? "");
  const back = "/admin/contracts/terminations";
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("admin_note") ?? "").trim();

  const { data } = await db()
    .from("termination_requests")
    .select("*, bank_account:bank_accounts(id, account_no)")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!data) fail(back, "Request not found or already decided");
  const req = data as unknown as { id: string; owner_id: string; bank_account_id: string };

  if (decision === "reject") {
    await db()
      .from("termination_requests")
      .update({ status: "rejected", admin_note: note || null, decided_by: cu.user.id, decided_at: new Date().toISOString() })
      .eq("id", id);
  } else if (decision === "approve") {
    if (!note) fail(back, "Record what was agreed with the agent (compensation) before approving");
    const today = new Date().toISOString().slice(0, 10);

    // Every contract line on this account ends today; single-account contracts
    // (customer, agent) terminate outright, the owner's shared one lives on.
    const { data: lines } = await db()
      .from("contract_accounts")
      .select("id, contract_id, contract:contracts!inner(party_type)")
      .eq("bank_account_id", req.bank_account_id)
      .is("ends_on", null);
    for (const l of (lines ?? []) as unknown as { id: string; contract_id: string; contract: { party_type: string } }[]) {
      await db().from("contract_accounts").update({ ends_on: today }).eq("id", l.id);
      if (l.contract.party_type !== "owner") {
        await db().from("contracts").update({ status: "terminated", ends_on: today }).eq("id", l.contract_id);
      }
    }
    await db()
      .from("bank_accounts")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", req.bank_account_id);
    await db()
      .from("account_assignments")
      .update({ status: "cancelled", cancel_reason: "Account terminated on the owner's request" })
      .eq("bank_account_id", req.bank_account_id)
      .neq("status", "cancelled");
    await db()
      .from("termination_requests")
      .update({ status: "approved", admin_note: note, decided_by: cu.user.id, decided_at: new Date().toISOString() })
      .eq("id", id);
    const { notifyOwner } = await import("@/modules/notifications/lib");
    await notifyOwner(req.owner_id, "general", "Account termination approved", "Your termination request was approved — the account is closed.").catch(() => {});
  } else {
    fail(back, "Unknown decision");
  }
  revalidatePath(back);
  redirect(`${back}?saved=${decision}`);
}

/** The parcel left: courier and tracking number onto the record. */
export async function markAssignmentShipped(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("contracts", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/contracts/assignments");
  const courier = String(formData.get("courier") ?? "").trim();
  const trackingNo = String(formData.get("tracking_no") ?? "").trim();
  if (!courier || !trackingNo) fail(back, "Enter the courier and the tracking number");

  const { data } = await db()
    .from("account_assignments")
    .update({
      courier,
      tracking_no: trackingNo,
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id)
    .eq("status", "confirmed")
    .eq("delivery_method", "shipping")
    .select("id");
  if (!data || data.length === 0) fail(back, "Only a confirmed shipping assignment can be marked shipped");
  revalidatePath(back);
  redirect(`${back}?saved=shipped`);
}

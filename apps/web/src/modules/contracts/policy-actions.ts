"use server";

// Contract Policy actions: the owner guardrails, the default condition
// template, and each agent's own condition table.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { copyTemplateToAgent } from "./policy";

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

/** Resolve who may touch which merchant/country, from either side. */
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

export async function saveConditionRow(formData: FormData): Promise<void> {
  const { cu, back, merchantId, countryId } = await scopeOf(formData);
  const id = String(formData.get("row_id") ?? "") || null;
  const agentId = String(formData.get("agent_id") ?? "") || null;
  await guardAgent(merchantId, agentId, back);

  const bankId = String(formData.get("bank_id") ?? "");
  if (!bankId) fail(back, "Pick the bank");
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const modeRaw = String(formData.get("mode") ?? "rent");
  const mode = ["rent", "turnover", "rent_plus_turnover", "max"].includes(modeRaw) ? modeRaw : "rent";
  const rent = num(formData.get("rent"));
  const pct = num(formData.get("turnover_pct"));
  const contractMonths = mode === "turnover" ? null : int(formData.get("contract_months"));
  const renewalMonths = mode === "turnover" ? null : int(formData.get("renewal_months"));
  const deposit = num(formData.get("deposit"));

  if (mode !== "turnover" && rent <= 0) fail(back, "This mode needs a rent amount");
  if (mode !== "rent" && pct <= 0) fail(back, "This mode needs a turnover %");
  if (mode !== "turnover" && !contractMonths) fail(back, "This mode needs contract months");

  const row = {
    merchant_id: merchantId,
    country_id: countryId,
    agent_id: agentId,
    bank_id: bankId,
    channel,
    mode,
    rent: mode === "turnover" ? 0 : rent,
    turnover_pct: mode === "rent" ? null : pct,
    contract_months: contractMonths,
    renewal_months: renewalMonths,
    deposit,
  };

  // One row per bank × channel (or one default per bank) within a table.
  let clash = db()
    .from("agent_condition_rows")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .eq("bank_id", bankId);
  clash = agentId ? clash.eq("agent_id", agentId) : clash.is("agent_id", null);
  clash = channel ? clash.eq("channel", channel) : clash.is("channel", null);
  const { data: existing } = await clash.maybeSingle();
  if (existing && existing.id !== id)
    fail(back, channel ? `There is already a row for this bank × ${channel}` : "This bank already has a default row");

  const { error } = id
    ? await db().from("agent_condition_rows").update(row).eq("id", id).eq("merchant_id", merchantId)
    : await db().from("agent_condition_rows").insert({ ...row, created_by: cu.user.id });
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=row`);
}

export async function deleteConditionRow(formData: FormData): Promise<void> {
  const { back, merchantId } = await scopeOf(formData);
  const id = String(formData.get("row_id") ?? "");
  await db().from("agent_condition_rows").delete().eq("id", id).eq("merchant_id", merchantId);
  revalidatePath(back);
  redirect(back);
}

export async function copyTemplateToAgentAction(formData: FormData): Promise<void> {
  const { cu, back, merchantId, countryId } = await scopeOf(formData);
  const agentId = String(formData.get("agent_id") ?? "");
  if (!agentId) fail(back, "Missing agent");
  await guardAgent(merchantId, agentId, back);
  const copied = await copyTemplateToAgent(merchantId, countryId, agentId, cu.user.id);
  revalidatePath(back);
  redirect(`${back}?saved=copied&count=${copied}`);
}

import "server-only";
import { db } from "@/lib/supabase";
import { firstOfMonth, addMonths, addDays, lastOfMonth } from "@/modules/billing/engine";

// The policy layer: the white label's guardrails for owner terms, their agent
// condition table, and the wiring that turns an activating bank account into
// billing contracts automatically.

export type ContractPolicy = {
  id: string;
  merchant_id: string;
  country_id: string;
  owner_rent_min: number;
  owner_rent_max: number;
  owner_min_contract_months: number;
  owner_min_renewal_months: number;
};

export type OwnerTerms = {
  id: string;
  owner_id: string;
  rent: number;
  contract_months: number;
  renewal_months: number;
  effective_from: string;
  effective_to: string | null;
};

export type ConditionRow = {
  id: string;
  merchant_id: string;
  country_id: string;
  /** Null = a row of the white label's default template. */
  agent_id: string | null;
  bank_id: string;
  channel: string | null;
  mode: "rent" | "turnover" | "rent_plus_turnover" | "max";
  rent: number;
  turnover_pct: number | null;
  contract_months: number | null;
  renewal_months: number | null;
  deposit: number;
  sort: number;
  bank?: { name: string; code?: string | null } | null;
};

export async function contractPolicy(merchantId: string, countryId: string): Promise<ContractPolicy | null> {
  const { data } = await db()
    .from("contract_policies")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .maybeSingle();
  return (data ?? null) as ContractPolicy | null;
}

/** The owner's terms version that applies today. */
export async function currentOwnerTerms(ownerId: string): Promise<OwnerTerms | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("owner_contract_terms")
    .select("*")
    .eq("owner_id", ownerId)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("effective_from", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] ?? null) as OwnerTerms | null;
}

/** The version that will apply next month, if a change is already queued. */
export async function pendingOwnerTerms(ownerId: string): Promise<OwnerTerms | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("owner_contract_terms")
    .select("*")
    .eq("owner_id", ownerId)
    .gt("effective_from", today)
    .order("effective_from", { ascending: true })
    .limit(1);
  return ((data ?? [])[0] ?? null) as OwnerTerms | null;
}

/** One agent's rows, or the white label's default template (agentId null). */
export async function conditionRows(
  merchantId: string,
  countryId: string,
  agentId: string | null
): Promise<ConditionRow[]> {
  let q = db()
    .from("agent_condition_rows")
    .select("*, bank:banks(name, code)")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  q = agentId ? q.eq("agent_id", agentId) : q.is("agent_id", null);
  const { data } = await q;
  return (data ?? []) as unknown as ConditionRow[];
}

/** Stamp the template onto a fresh agent — their own copy, free to diverge. */
export async function copyTemplateToAgent(
  merchantId: string,
  countryId: string,
  agentId: string,
  byUserId: string
): Promise<number> {
  const existing = await conditionRows(merchantId, countryId, agentId);
  if (existing.length > 0) return 0;
  const template = await conditionRows(merchantId, countryId, null);
  if (template.length === 0) return 0;
  await db()
    .from("agent_condition_rows")
    .insert(
      template.map((r) => ({
        merchant_id: merchantId,
        country_id: countryId,
        agent_id: agentId,
        bank_id: r.bank_id,
        channel: r.channel,
        mode: r.mode,
        rent: r.rent,
        turnover_pct: r.turnover_pct,
        contract_months: r.contract_months,
        renewal_months: r.renewal_months,
        deposit: r.deposit,
        sort: r.sort,
        created_by: byUserId,
      }))
    );
  return template.length;
}

/**
 * The row an account falls under: the first exact bank + channel match in the
 * table's order, else the bank's default row (no channel). No row, no guess.
 */
export function resolveConditionRow(
  rows: ConditionRow[],
  bankId: string,
  channels: string[]
): ConditionRow | null {
  const forBank = rows.filter((r) => r.bank_id === bankId);
  const exact = forBank.find((r) => r.channel != null && channels.includes(r.channel));
  return exact ?? forBank.find((r) => r.channel == null) ?? null;
}

/** Validate proposed owner terms against the white label's policy. */
export function checkAgainstPolicy(
  policy: ContractPolicy | null,
  t: { rent: number; contract_months: number; renewal_months: number }
): string | null {
  if (!policy) return "The white label hasn't set its Contract Policy yet — owner terms can't be entered until it exists";
  if (policy.owner_rent_min > 0 && t.rent < policy.owner_rent_min)
    return `Rent is below the white label's minimum of ${policy.owner_rent_min}`;
  if (policy.owner_rent_max > 0 && t.rent > policy.owner_rent_max)
    return `Rent is above the white label's maximum of ${policy.owner_rent_max}`;
  if (t.contract_months < policy.owner_min_contract_months)
    return `The contract must run at least ${policy.owner_min_contract_months} months`;
  if (t.renewal_months < policy.owner_min_renewal_months)
    return `Renewal must be at least ${policy.owner_min_renewal_months} months`;
  return null;
}

/**
 * Change an owner's terms: the current version closes at the end of this
 * month, the new one runs from the 1st of the next — and every account of
 * theirs already billing follows the same seam. Months already run stand.
 */
export async function queueOwnerTermsChange(
  ownerId: string,
  next: { rent: number; contract_months: number; renewal_months: number },
  byUserId: string
): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = lastOfMonth(today);
  const nextFirst = firstOfMonth(addMonths(today, 1));

  const { data: contract } = await db()
    .from("contracts")
    .select("id, contract_accounts(id)")
    .eq("party_type", "owner")
    .eq("owner_id", ownerId)
    .neq("status", "terminated")
    .maybeSingle();
  const accounts = ((contract?.contract_accounts ?? []) as { id: string }[]).map((a) => a.id);

  // Nothing billing yet — no seam to respect, the terms simply become these.
  if (accounts.length === 0) {
    await db().from("owner_contract_terms").delete().eq("owner_id", ownerId);
    const { error } = await db().from("owner_contract_terms").insert({
      owner_id: ownerId,
      rent: next.rent,
      contract_months: next.contract_months,
      renewal_months: next.renewal_months,
      effective_from: today,
      created_by: byUserId,
    });
    return error ? `Failed to save the terms: ${error.message}` : null;
  }

  // Replace any not-yet-effective queued version outright.
  await db().from("owner_contract_terms").delete().eq("owner_id", ownerId).gt("effective_from", today);
  const current = await currentOwnerTerms(ownerId);
  if (current) {
    await db().from("owner_contract_terms").update({ effective_to: monthEnd }).eq("id", current.id);
  }
  const { error } = await db().from("owner_contract_terms").insert({
    owner_id: ownerId,
    rent: next.rent,
    contract_months: next.contract_months,
    renewal_months: next.renewal_months,
    effective_from: current ? nextFirst : today,
    created_by: byUserId,
  });
  if (error) return `Failed to save the terms: ${error.message}`;

  // Propagate to the owner's live billing terms at the same seam.
  for (const caId of accounts) {
    await db()
      .from("contract_terms")
      .update({ effective_to: monthEnd })
      .eq("contract_account_id", caId)
      .is("effective_to", null);
    await db().from("contract_terms").insert({
      contract_account_id: caId,
      base_rent: next.rent,
      turnover_rate: null,
      mode: "rent",
      effective_from: nextFirst,
      created_by: byUserId,
    });
  }
  return null;
}

/** Everything an owner form's Contract section needs, in one call. */
export async function ownerContractSection(
  merchantId: string,
  countryId: string,
  ownerId: string | null,
  opts?: { admin?: boolean }
): Promise<{
  current: { rent: number; contract_months: number; renewal_months: number } | null;
  hint: string | null;
  pendingNote: string | null;
}> {
  const { fmtNum } = await import("@/lib/format");
  const [policy, current, pending] = await Promise.all([
    contractPolicy(merchantId, countryId),
    ownerId ? currentOwnerTerms(ownerId) : Promise.resolve(null),
    ownerId ? pendingOwnerTerms(ownerId) : Promise.resolve(null),
  ]);
  const hint = opts?.admin
    ? policy
      ? `The white label's own limits (not enforced for platform staff): rent ${fmtNum(policy.owner_rent_min)}–${
          policy.owner_rent_max > 0 ? fmtNum(policy.owner_rent_max) : "no cap"
        }, contract ≥ ${policy.owner_min_contract_months} mo, renewal ≥ ${policy.owner_min_renewal_months} mo`
      : null
    : policy
      ? `Limits: rent ${fmtNum(policy.owner_rent_min)}–${
          policy.owner_rent_max > 0 ? fmtNum(policy.owner_rent_max) : "no cap"
        } · contract ≥ ${policy.owner_min_contract_months} months · renewal ≥ ${policy.owner_min_renewal_months} months`
      : "⚠ The white label hasn't set its Contract Policy yet — these terms will be refused until it exists.";
  return {
    current: current
      ? { rent: Number(current.rent), contract_months: current.contract_months, renewal_months: current.renewal_months }
      : null,
    hint,
    pendingNote: pending
      ? `A change to ${fmtNum(Number(pending.rent))} / ${pending.contract_months} mo is queued for ${pending.effective_from}.`
      : null,
  };
}

/**
 * Read the Contract section of an owner form and apply it. Returns an error
 * to show, or null. Absent fields (a form without the section) are a no-op.
 */
export async function applyOwnerTermsFromForm(
  ownerId: string,
  formData: FormData,
  byUserId: string,
  policy: ContractPolicy | null,
  enforce: boolean
): Promise<string | null> {
  const rentRaw = formData.get("ct_rent");
  if (rentRaw == null) return null;
  const rent = parseFloat(String(rentRaw).replace(/,/g, ""));
  const contractMonths = parseInt(String(formData.get("ct_contract_months") ?? ""), 10);
  const renewalMonths = parseInt(String(formData.get("ct_renewal_months") ?? ""), 10);
  if (!Number.isFinite(rent) || rent <= 0) return "Enter the owner's rent per account";
  if (!Number.isInteger(contractMonths) || contractMonths <= 0) return "Enter the contract months";
  if (!Number.isInteger(renewalMonths) || renewalMonths <= 0) return "Enter the renewal months";

  const next = { rent, contract_months: contractMonths, renewal_months: renewalMonths };
  if (enforce) {
    const err = checkAgainstPolicy(policy, next);
    if (err) return err;
  }
  const current = await currentOwnerTerms(ownerId);
  if (
    current &&
    Number(current.rent) === rent &&
    current.contract_months === contractMonths &&
    current.renewal_months === renewalMonths
  ) {
    return null;
  }
  return queueOwnerTermsChange(ownerId, next, byUserId);
}

/**
 * The automatic wiring when a bank account goes active: the owner's terms
 * become their billing contract (one contract per owner, accounts join it),
 * and the agent's matrix row freezes into a per-account contract of its own.
 * Everything is idempotent — approving twice wires nothing twice.
 */
export async function wireAccountContracts(bankAccountId: string, byUserId: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: acc } = await db()
    .from("bank_accounts")
    .select("id, merchant_id, country_id, bank_id, owner_id, channels, account_no, bank:banks(name)")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (!acc) return "Account not found";
  if (!acc.owner_id) return null; // nothing to wire without an owner

  // ---- owner side ----
  const terms = await currentOwnerTerms(acc.owner_id);
  if (!terms) return "This owner has no contract terms on file — set them on the owner's page before approving";

  let { data: ownerContract } = await db()
    .from("contracts")
    .select("id")
    .eq("party_type", "owner")
    .eq("owner_id", acc.owner_id)
    .neq("status", "terminated")
    .maybeSingle();
  if (!ownerContract) {
    const term0 = firstOfMonth(addMonths(today, 1));
    const { data: created, error } = await db()
      .from("contracts")
      .insert({
        merchant_id: acc.merchant_id,
        country_id: acc.country_id,
        party_type: "owner",
        owner_id: acc.owner_id,
        min_term_months: terms.contract_months,
        renewal_min_months: terms.renewal_months,
        deposit: 0,
        status: "active",
        starts_on: today,
        // The term runs from the 1st after the first account; renewal extends it.
        ends_on: addDays(addMonths(term0, terms.contract_months), -1),
        notes: "Created automatically from the owner's terms",
        created_by: byUserId,
      })
      .select("id")
      .single();
    if (error || !created) return `Failed to open the owner's contract: ${error?.message}`;
    ownerContract = created;
  }

  const { data: existingOwnerCa } = await db()
    .from("contract_accounts")
    .select("id")
    .eq("contract_id", ownerContract.id)
    .eq("bank_account_id", bankAccountId)
    .maybeSingle();
  if (!existingOwnerCa) {
    const { data: ca, error } = await db()
      .from("contract_accounts")
      .insert({ contract_id: ownerContract.id, bank_account_id: bankAccountId, starts_on: today, created_by: byUserId })
      .select("id")
      .single();
    if (error || !ca) return `Failed to add the account to the owner's contract: ${error?.message}`;
    await db().from("contract_terms").insert({
      contract_account_id: ca.id,
      base_rent: terms.rent,
      turnover_rate: null,
      mode: "rent",
      effective_from: today,
      created_by: byUserId,
    });
  }

  // ---- agent side ----
  const { data: owner } = await db().from("owners").select("agent_id").eq("id", acc.owner_id).maybeSingle();
  const agentRow = owner?.agent_id ? { id: owner.agent_id as string } : null;
  if (!agentRow) return null; // no agent brought this owner — nothing more to wire

  // Already wired for this account?
  const { data: existingAgent } = await db()
    .from("contract_accounts")
    .select("id, contract:contracts!inner(party_type, agent_id)")
    .eq("bank_account_id", bankAccountId)
    .eq("contract.party_type", "agent")
    .maybeSingle();
  if (existingAgent) return null;

  const rows = await conditionRows(acc.merchant_id, acc.country_id ?? "", agentRow.id);
  const row = resolveConditionRow(rows, acc.bank_id, (acc.channels as string[] | null) ?? []);
  const bankName = (acc.bank as { name?: string } | null)?.name ?? "this bank";
  if (!row) return `This agent has no conditions for ${bankName} — add a row on the agent's page first`;

  const { data: agentContract, error: acErr } = await db()
    .from("contracts")
    .insert({
      merchant_id: acc.merchant_id,
      country_id: acc.country_id,
      party_type: "agent",
      agent_id: agentRow.id,
      min_term_months: row.contract_months ?? 0,
      renewal_min_months: row.renewal_months ?? 0,
      deposit: row.deposit,
      theft_window_months: row.contract_months,
      theft_window_open: row.mode === "turnover",
      status: "active",
      starts_on: today,
      // Pure turnover has no term at all; everything else ends and renews.
      ends_on: row.contract_months
        ? addDays(addMonths(firstOfMonth(addMonths(today, 1)), row.contract_months), -1)
        : null,
      notes: `Conditions frozen at activation: ${bankName}${row.channel ? ` × ${row.channel}` : " (bank default)"}`,
      created_by: byUserId,
    })
    .select("id")
    .single();
  if (acErr || !agentContract) return `Failed to open the agent's contract: ${acErr?.message}`;

  const { data: agentCa, error: caErr } = await db()
    .from("contract_accounts")
    .insert({
      contract_id: agentContract.id,
      bank_account_id: bankAccountId,
      starts_on: today,
      agent_snapshot: {
        row_id: row.id,
        bank: bankName,
        channel: row.channel,
        mode: row.mode,
        rent: row.rent,
        turnover_pct: row.turnover_pct,
        contract_months: row.contract_months,
        renewal_months: row.renewal_months,
        deposit: row.deposit,
        frozen_on: today,
      },
      created_by: byUserId,
    })
    .select("id")
    .single();
  if (caErr || !agentCa) return `Failed to add the account to the agent's contract: ${caErr?.message}`;

  await db().from("contract_terms").insert({
    contract_account_id: agentCa.id,
    base_rent: row.mode === "turnover" ? 0 : row.rent,
    turnover_rate: row.mode === "rent" ? null : row.turnover_pct,
    mode: row.mode,
    effective_from: today,
    created_by: byUserId,
  });
  return null;
}

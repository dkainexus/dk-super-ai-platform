"use server";

// Bank Accounts module actions: create (admin/merchant) + review workflow.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { notifyOwner } from "@/modules/notifications/lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate() {
  revalidatePath("/admin/bank-accounts");
  revalidatePath("/m/bank-accounts");
}

/** Shared parser: bank-specific extra fields + payment channels from a form. */
export async function parseBankExtras(
  bankId: string,
  formData: FormData
): Promise<{ extra: Record<string, string>; channels: Record<string, { enabled: boolean; value?: string }> }> {
  const { data: bank } = await db()
    .from("banks")
    .select("account_fields, country:countries(payment_channels)")
    .eq("id", bankId)
    .maybeSingle();
  const fields = ((bank?.account_fields ?? []) as { key: string; label: string }[]) || [];
  const chans = (((bank?.country as { payment_channels?: string[] } | null)?.payment_channels ?? []) as string[]) || [];
  const extra: Record<string, string> = {};
  for (const f of fields) {
    const v = String(formData.get(`extra_${f.key}`) ?? "").trim();
    if (v) extra[f.key] = v;
  }
  const channels: Record<string, { enabled: boolean; value?: string }> = {};
  for (const c of chans) {
    const enabled = formData.get(`channel_${c}`) === "on";
    const value = String(formData.get(`channel_${c}_value`) ?? "").trim();
    channels[c] = { enabled, ...(value ? { value } : {}) };
  }
  return { extra, channels };
}


/** Branch fields from the BranchPicker (Google Places). */
function branchFields(formData: FormData): Record<string, unknown> {
  const lat = String(formData.get("branch_lat") ?? "");
  const lng = String(formData.get("branch_lng") ?? "");
  return {
    branch_name: String(formData.get("branch_name") ?? "").trim() || null,
    branch_address: String(formData.get("branch_address") ?? "").trim() || null,
    branch_place_id: String(formData.get("branch_place_id") ?? "").trim() || null,
    branch_lat: lat ? parseFloat(lat) : null,
    branch_lng: lng ? parseFloat(lng) : null,
  };
}

function conditionOf(formData: FormData): "New" | "Old" {
  return String(formData.get("condition") ?? "New") === "Old" ? "Old" : "New";
}

export async function createBankAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "add");
  const list = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  // Errors go back to the form the user is standing on, not the list.
  const base = `${list}/new`;
  const companyId = String(formData.get("company_id") ?? "");
  const bankId = String(formData.get("bank_id") ?? "");
  const accountNo = String(formData.get("account_no") ?? "").trim();
  if (!companyId) fail(base, "Please choose a company");
  if (!bankId) fail(base, "Please choose a bank");
  if (!accountNo) fail(base, "Please enter the account number");

  // The same number at the same bank is the same account, whoever submits it.
  const { data: clash } = await db()
    .from("bank_accounts")
    .select("id, ref, status")
    .eq("bank_id", bankId)
    .eq("account_no", accountNo)
    .maybeSingle();
  if (clash) {
    fail(base, `That account already exists${clash.ref ? ` (${clash.ref})` : ""} — ${clash.status}.`);
  }

  const { data: company } = await db()
    .from("companies")
    .select("id, merchant_id, country_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) fail(base, "Company not found");
  if (cu.merchant && company.merchant_id !== cu.merchant.id) fail(base, "Company not found");

  const { extra, channels } = await parseBankExtras(bankId, formData);
  const limitRaw = String(formData.get("account_limit") ?? "").trim();

  const branch = branchFields(formData);
  if (!branch.branch_name) fail(base, "Please search and pick the branch");

  const { data: created, error } = await db().from("bank_accounts").insert({
    merchant_id: company.merchant_id,
    country_id: company.country_id,
    company_id: companyId,
    bank_id: bankId,
    ...branch,
    condition: conditionOf(formData),
    account_no: accountNo,
    account_limit: limitRaw ? parseFloat(limitRaw) || null : null,
    email: String(formData.get("email") ?? "").trim() || null,
    sim_number: String(formData.get("sim_number") ?? "").trim() || null,
    login_id: String(formData.get("login_id") ?? "").trim() || null,
    password: String(formData.get("password") ?? "").trim() || null,
    extra,
    channels,
    // Created in the back office by a human who already checked it — live now.
    status: "active",
    activated_at: new Date().toISOString(),
    created_by: cu.user.id,
  }).select("id").single();
  if (error)
    fail(
      base,
      error.message.includes("duplicate") || error.message.includes("bank_accounts_bank_account_no_uidx")
        ? "That account number is already registered at this bank"
        : `Failed to create: ${error.message}`
    );

  // Going live means contracts: the owner's terms and the agent's frozen
  // conditions wire in now. If they can't, the account waits as pending.
  if (created?.id) {
    const { wireAccountContracts } = await import("@/modules/contracts/policy");
    const wireError = await wireAccountContracts(created.id, cu.user.id);
    if (wireError) {
      await db().from("bank_accounts").update({ status: "pending", activated_at: null }).eq("id", created.id);
      fail(base, `Saved as pending — ${wireError}`);
    }
  }
  revalidate();
  redirect(list);
}

export async function reviewBankAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "edit");
  const base = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("review_action") ?? "");
  const back = String(formData.get("back") ?? base);

  let q = db().from("bank_accounts").select("id, owner_id, status, bank:banks(name)").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data: row } = await q.maybeSingle();
  if (!row) fail(back, "Account not found");
  const bankName = (row.bank as { name?: string } | null)?.name ?? "bank";

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now, updated_by: cu.user.id };
  let notify: { title: string; body: string } | null = null;
  let rewardOnApproval = false;

  if (action === "approve") {
    // Wire the contracts first — an approval that can't bill isn't an approval.
    const { wireAccountContracts } = await import("@/modules/contracts/policy");
    const wireError = await wireAccountContracts(id, cu.user.id);
    if (wireError) fail(back, wireError);
    patch.status = "active";
    patch.activated_at = now;
    rewardOnApproval = true;
    patch.suspended_at = null;
    patch.closed_at = null;
    patch.reject_reason = null;
    notify = { title: "Bank account approved ✅", body: `Your ${bankName} account has been approved and is now active.` };
  } else if (action === "reject") {
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) fail(back, "Please give a reason for rejecting");
    patch.status = "rejected";
    patch.reject_reason = reason;
    notify = { title: "Bank account rejected", body: `Your ${bankName} account was rejected: ${reason}` };
  } else if (action === "suspend") {
    patch.status = "suspended";
    patch.suspended_at = now;
  } else if (action === "reactivate") {
    patch.status = "active";
    patch.suspended_at = null;
  } else if (action === "close") {
    patch.status = "closed";
    patch.closed_at = now;
  } else {
    fail(back, "Unknown action");
  }

  const { error } = await db().from("bank_accounts").update(patch).eq("id", id);
  if (error) fail(back, `Failed to update: ${error.message}`);
  if (notify && row.owner_id) {
    await notifyOwner(row.owner_id, "general", notify.title, notify.body).catch(() => {});
  }
  if (rewardOnApproval && row.owner_id) {
    await payNewAccountReward(id, row.owner_id).catch(() => {});
  }
  revalidate();
  redirect(back);
}

export async function deleteBankAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "delete");
  const base = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  const id = String(formData.get("id") ?? "");
  let q = db().from("bank_accounts").delete().eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  await q;
  revalidate();
  redirect(base);
}

/** Change the branch on an account (search Google again). */
export async function assignBranch(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "edit");
  const base = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? base);
  const branch = branchFields(formData);
  if (!branch.branch_name) fail(back, "Please search and pick the branch");

  let q = db().from("bank_accounts").update({ ...branch, updated_at: new Date().toISOString() }).eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { error } = await q;
  if (error) fail(back, `Failed to save branch: ${error.message}`);
  revalidate();
  redirect(back);
}

/** Edit an account's details (standard fields + the bank's extra fields). */
export async function editBankAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "edit");
  const base = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? base);
  const accountNo = String(formData.get("account_no") ?? "").trim();
  if (!accountNo) fail(back, "Account number cannot be empty");

  let q = db().from("bank_accounts").select("id, bank_id").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data: row } = await q.maybeSingle();
  if (!row) fail(back, "Account not found");

  const { data: clash } = await db()
    .from("bank_accounts")
    .select("id, ref")
    .eq("bank_id", row.bank_id)
    .eq("account_no", accountNo)
    .neq("id", id)
    .maybeSingle();
  if (clash) fail(back, `That account number is already registered at this bank${clash.ref ? ` (${clash.ref})` : ""}`);

  const { extra, channels } = await parseBankExtras(row.bank_id, formData);
  const branch = branchFields(formData);
  const limitRaw = String(formData.get("account_limit") ?? "").trim();
  const { error } = await db()
    .from("bank_accounts")
    .update({
      account_no: accountNo,
      account_limit: limitRaw ? parseFloat(limitRaw) || null : null,
      email: String(formData.get("email") ?? "").trim() || null,
      sim_number: String(formData.get("sim_number") ?? "").trim() || null,
      login_id: String(formData.get("login_id") ?? "").trim() || null,
      password: String(formData.get("password") ?? "").trim() || null,
      condition: conditionOf(formData),
      asking_price: String(formData.get("asking_price") ?? "").trim()
        ? parseFloat(String(formData.get("asking_price")).replace(/,/g, "")) || null
        : null,
      own_use: formData.get("own_use") === "on",
      ...(branch.branch_name ? branch : {}),
      extra,
      channels,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidate();
  redirect(back);
}


/** The country's "new bank account" reward, paid once per account. */
async function payNewAccountReward(accountId: string, ownerId: string): Promise<void> {
  const { data: owner } = await db()
    .from("owners")
    .select("id, merchant_id, country_id, country:countries(currency, new_account_reward)")
    .eq("id", ownerId)
    .maybeSingle();
  const country = (Array.isArray(owner?.country) ? owner?.country[0] : owner?.country) as
    | { currency: string; new_account_reward: number }
    | undefined;
  const amount = Number(country?.new_account_reward ?? 0);
  if (!owner || !country || !(amount > 0)) return;

  const { walletApply } = await import("@/modules/wallet/lib");
  try {
    await walletApply({
      ownerId: owner.id,
      currency: country.currency,
      type: "reward",
      amount,
      reference: `bank_account_${accountId}`,
      note: "New bank account reward",
      merchantId: owner.merchant_id,
    });
    await notifyOwner(
      owner.id,
      "reward",
      "Reward credited 🎉",
      `${amount.toLocaleString()} ${country.currency} for adding a new bank account.`
    );
  } catch (e) {
    // duplicate reference = already paid
    if (!(e instanceof Error && /duplicate|unique/i.test(e.message))) throw e;
  }
}

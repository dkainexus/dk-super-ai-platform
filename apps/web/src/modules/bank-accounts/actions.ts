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
  const { data: bank } = await db().from("banks").select("account_fields, channels").eq("id", bankId).maybeSingle();
  const fields = ((bank?.account_fields ?? []) as { key: string; label: string }[]) || [];
  const chans = ((bank?.channels ?? []) as string[]) || [];
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

export async function createBankAccount(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("bank_accounts", "add");
  const base = cu.merchant ? "/m/bank-accounts" : "/admin/bank-accounts";
  const companyId = String(formData.get("company_id") ?? "");
  const bankId = String(formData.get("bank_id") ?? "");
  const accountNo = String(formData.get("account_no") ?? "").trim();
  if (!companyId) fail(base, "Please choose a company");
  if (!bankId) fail(base, "Please choose a bank");
  if (!accountNo) fail(base, "Please enter the account number");

  const { data: company } = await db()
    .from("companies")
    .select("id, merchant_id, country_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) fail(base, "Company not found");
  if (cu.merchant && company.merchant_id !== cu.merchant.id) fail(base, "Company not found");

  const { extra, channels } = await parseBankExtras(bankId, formData);
  const limitRaw = String(formData.get("account_limit") ?? "").trim();

  const { error } = await db().from("bank_accounts").insert({
    merchant_id: company.merchant_id,
    country_id: company.country_id,
    company_id: companyId,
    bank_id: bankId,
    branch_address: String(formData.get("branch_address") ?? "").trim() || null,
    account_no: accountNo,
    account_limit: limitRaw ? parseFloat(limitRaw) || null : null,
    email: String(formData.get("email") ?? "").trim() || null,
    sim_number: String(formData.get("sim_number") ?? "").trim() || null,
    login_id: String(formData.get("login_id") ?? "").trim() || null,
    password: String(formData.get("password") ?? "").trim() || null,
    extra,
    channels,
    status: "pending",
    created_by: cu.user.id,
  });
  if (error) fail(base, `Failed to create: ${error.message}`);
  revalidate();
  redirect(base);
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
  const patch: Record<string, unknown> = { updated_at: now };
  let notify: { title: string; body: string } | null = null;

  if (action === "approve") {
    patch.status = "active";
    patch.condition = "New";
    patch.activated_at = now;
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

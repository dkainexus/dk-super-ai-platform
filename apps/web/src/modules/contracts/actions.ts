"use server";

// Contracts are written by the system — owner terms, agent condition tables
// and customer conditions wire them up at activation and confirmation. What
// remains here is the lifecycle a human still owns: renewing, terminating,
// and ending a single account's billing.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { addDays, addMonths, firstOfMonth } from "@/modules/billing/engine";
import { renewalState, today, type Contract } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate(id?: string) {
  revalidatePath("/admin/contracts");
  if (id) revalidatePath(`/admin/contracts/${id}`);
}

const int = (v: FormDataEntryValue | null, fallback: number) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

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

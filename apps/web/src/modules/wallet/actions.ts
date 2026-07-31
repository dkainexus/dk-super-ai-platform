"use server";

// Wallet module actions: manual credits (reward / rent / adjustment),
// withdrawal processing (paid / rejected+refund) and module settings.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { notifyOwner } from "@/modules/notifications/lib";
import { walletApply } from "./lib";
import type { Withdrawal } from "@/lib/types";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** Manual credit (or negative adjustment) into an owner's wallet. */
export async function manualCredit(formData: FormData): Promise<void> {
  const { cu, scope } = await requirePerm("wallet", "add");
  // Money moves by the platform's hand alone — the portal only watches.
  if (cu.merchant) fail("/m/wallets", "Wallet operations are handled by the platform");
  const ownerId = String(formData.get("owner_id") ?? "");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/wallets" : "/admin/wallets"));

  const { data: owner } = await db()
    .from("owners")
    .select("id, merchant_id, status, full_name, country:countries(currency)")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner) fail(back, "Owner not found");
  if (scope !== "all" && owner.merchant_id !== cu.user.merchant_id) redirect(back);
  if (owner.status === "banned") fail(back, "Banned owners cannot receive credits");

  const type = String(formData.get("type") ?? "reward");
  if (!["reward", "rent", "adjustment"].includes(type)) fail(back, "Invalid credit type");
  const amount = parseFloat(String(formData.get("amount") ?? ""));
  if (!Number.isFinite(amount) || amount === 0) fail(back, "Please enter a non-zero amount");
  if (amount < 0 && type !== "adjustment") fail(back, "Only adjustments can be negative");
  const note = String(formData.get("note") ?? "").trim() || null;
  const currency = (owner.country as { currency?: string } | null)?.currency ?? "THB";

  try {
    await walletApply({
      ownerId: owner.id,
      currency,
      type: type as "reward" | "rent" | "adjustment",
      amount,
      note,
      createdBy: cu.user.id,
    });
  } catch (e) {
    fail(back, e instanceof Error && e.message.includes("insufficient") ? "Insufficient balance for this deduction" : `Failed: ${e instanceof Error ? e.message : "unknown"}`);
  }

  if (amount > 0) {
    await notifyOwner(
      owner.id,
      "reward",
      type === "rent" ? "Rent credited 💸" : "Reward credited 🎉",
      `${amount.toLocaleString()} ${currency} has been added to your wallet.${note ? ` ${note}` : ""}`,
      cu.user.id
    );
  }
  revalidatePath(back);
  redirect(back);
}

type Actor = { user: { id: string; merchant_id: string | null } };

/**
 * Pay or reject one pending withdrawal. Returns an error string instead of
 * throwing so the bulk action can skip a bad row and keep going.
 */
async function processOne(
  id: string,
  decision: string,
  reason: string | null,
  cu: Actor,
  scope: string
): Promise<string | null> {
  const { data } = await db().from("withdrawals").select("*").eq("id", id).maybeSingle();
  if (!data) return "Withdrawal not found";
  const w = data as Withdrawal;
  if (w.status !== "pending") return "This withdrawal was already processed";

  const { data: owner } = await db()
    .from("owners")
    .select("id, merchant_id")
    .eq("id", w.owner_id)
    .maybeSingle();
  if (!owner) return "Owner not found";
  if (scope !== "all" && owner.merchant_id !== cu.user.merchant_id) return "Out of scope";

  if (decision === "paid") {
    await db()
      .from("withdrawals")
      .update({ status: "paid", processed_at: new Date().toISOString(), processed_by: cu.user.id })
      .eq("id", id);
    await notifyOwner(
      w.owner_id,
      "reward",
      "Withdrawal paid ✅",
      `Your withdrawal of ${w.amount.toLocaleString()} ${w.currency} has been transferred to your bank account.`,
      cu.user.id
    );
  } else if (decision === "reject") {
    // Refund the held amount back into the wallet.
    await walletApply({
      ownerId: w.owner_id,
      currency: w.currency,
      type: "refund",
      amount: w.amount,
      reference: `withdrawal_refund_${w.id}`,
      note: reason ? `Withdrawal rejected: ${reason}` : "Withdrawal rejected",
      createdBy: cu.user.id,
    });
    await db()
      .from("withdrawals")
      .update({
        status: "rejected",
        reject_reason: reason,
        processed_at: new Date().toISOString(),
        processed_by: cu.user.id,
      })
      .eq("id", id);
    await notifyOwner(
      w.owner_id,
      "reward",
      "Withdrawal rejected",
      `Your withdrawal of ${w.amount.toLocaleString()} ${w.currency} was rejected and refunded to your wallet.${reason ? ` Reason: ${reason}` : ""}`,
      cu.user.id
    );
  } else {
    return "Invalid decision";
  }
  return null;
}

/** Mark a withdrawal paid (after the manual bank transfer) or reject it (refund). */
export async function processWithdrawal(formData: FormData): Promise<void> {
  const { cu, scope } = await requirePerm("wallet", "edit");
  // Money moves by the platform's hand alone — the portal only watches.
  if (cu.merchant) fail("/m/wallets", "Wallet operations are handled by the platform");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/wallets" : "/admin/wallets/withdrawals"));
  const err = await processOne(
    String(formData.get("id") ?? ""),
    String(formData.get("decision") ?? ""),
    String(formData.get("reason") ?? "").trim() || null,
    cu,
    scope
  );
  if (err) fail(back, err);
  revalidatePath(back);
  redirect(back);
}

/** Same decision applied to every ticked row in the queue. */
export async function bulkProcessWithdrawals(formData: FormData): Promise<void> {
  const { cu, scope } = await requirePerm("wallet", "edit");
  // Money moves by the platform's hand alone — the portal only watches.
  if (cu.merchant) fail("/m/wallets", "Wallet operations are handled by the platform");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/wallets" : "/admin/wallets/withdrawals"));
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (ids.length === 0) fail(back, "Tick at least one withdrawal first");

  let done = 0;
  let firstError: string | null = null;
  for (const id of ids) {
    const err = await processOne(id, decision, reason, cu, scope);
    if (err) firstError ??= err;
    else done++;
  }
  if (done === 0) fail(back, firstError ?? "Nothing was processed");
  revalidatePath(back);
  redirect(`${back}${back.includes("?") ? "&" : "?"}done=${done}`);
}

/** Wallet module settings: training-completion reward amount per country. */

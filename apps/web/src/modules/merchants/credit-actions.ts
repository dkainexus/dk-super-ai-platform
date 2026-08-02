"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { checkTrc20Payment } from "@/modules/billing/tron";
import { creditBalance, creditConfig } from "./credits";

// A reported transfer only counts while it is fresh — an old hash is more
// likely a replay than a purchase, so age failures close the door.
const MAX_TX_AGE_DAYS = 7;

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

/** WL pays USDT on-chain and reports the hash; the chain decides. */
export async function buyCreditsWithTx(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("settings", "view");
  const back = "/m/credits";
  const hash = String(formData.get("tx_hash") ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) fail(back, "That doesn't look like a transaction hash");

  const cfg = await creditConfig();
  if (!cfg.usdt_address_trc20) fail(back, "Top-ups are not open yet — contact the platform");
  if (!(cfg.usdt_per_credit > 0)) fail(back, "Credit price is not configured — contact the platform");

  const { data: dupe } = await db().from("credit_ledger").select("id").eq("tx_hash", hash).maybeSingle();
  if (dupe) fail(back, "This transaction has already been used");

  const check = await checkTrc20Payment(hash, cfg.usdt_address_trc20);
  if (!check.ok) fail(back, check.reason);
  if (!check.at || Date.now() - new Date(check.at).getTime() > MAX_TX_AGE_DAYS * 24 * 3600 * 1000) {
    fail(back, `Only transfers from the last ${MAX_TX_AGE_DAYS} days are accepted`);
  }

  const credits = Math.floor(check.usdt / cfg.usdt_per_credit);
  if (credits < 1) fail(back, `That transfer (${check.usdt} USDT) is below the price of one credit (${cfg.usdt_per_credit} USDT)`);

  const { error } = await db().from("credit_ledger").insert({
    merchant_id: merchant.id,
    delta: credits,
    reason: "topup",
    tx_hash: hash,
    usdt_amount: check.usdt,
  });
  if (error) {
    fail(back, error.message.includes("duplicate") ? "This transaction has already been used" : `Failed: ${error.message}`);
  }
  revalidatePath(back);
  redirect(`${back}?saved=${credits}`);
}

/** The white label's own review of an agent submission — approval spends credits. */
export async function merchantReviewOwner(formData: FormData): Promise<void> {
  const cu = await requireMerchantUser();
  await requirePerm("owners", "edit");
  const merchant = cu.merchant;
  const id = String(formData.get("id") ?? "");
  const back = `/m/owners/${id}`;
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (decision !== "approved" && decision !== "rejected") fail(back, "Invalid operation");
  if (decision === "rejected" && !reason) fail(back, "Please provide a rejection reason");

  const { data: owner } = await db()
    .from("owners")
    .select("id, status, telegram_user_id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!owner) fail(back, "Owner not found");
  if (owner.status !== "pending") fail(back, "Only a pending submission can be reviewed");

  if (decision === "approved") {
    const cfg = await creditConfig();
    const cost = Math.max(0, cfg.credits_per_approval);
    if (cost > 0) {
      const balance = await creditBalance(merchant.id);
      if (balance < cost) {
        fail(back, `Not enough credits (${balance} left, approval costs ${cost}) — top up on the Credits page first`);
      }
      await db().from("credit_ledger").insert({
        merchant_id: merchant.id,
        delta: -cost,
        reason: "approval",
        owner_id: id,
        created_by: cu.user.id,
      });
    }
  }

  const { error } = await db()
    .from("owners")
    .update({
      status: decision,
      reject_reason: decision === "rejected" ? reason : null,
      reviewed_by: cu.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(back, `Failed to save the review: ${error.message}`);

  if (owner.telegram_user_id) {
    await db().from("bot_jobs").insert({
      job_type: "onboarding.notify_cms_owner_review",
      target_bot: "onboarding",
      scope: { owner_id: id },
      payload: { telegram_user_id: owner.telegram_user_id, decision, reason },
      requested_by: { source: "web", staff_id: cu.user.id },
    });
  }
  revalidatePath("/m/owners");
  revalidatePath(back);
  redirect(back);
}

/** Platform-side manual adjustment: grant or claw back credits. */
export async function adjustCredits(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("merchants", "edit");
  if (cu.merchant) redirect("/m");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const back = String(formData.get("back") ?? `/admin/white-labels/${merchantId}`);
  const delta = parseInt(String(formData.get("delta") ?? ""), 10);
  if (!Number.isFinite(delta) || delta === 0) fail(back, "Enter the credit amount (negative to deduct)");

  await db().from("credit_ledger").insert({
    merchant_id: merchantId,
    delta,
    reason: "manual",
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: cu.user.id,
  });
  revalidatePath(back);
  redirect(back);
}

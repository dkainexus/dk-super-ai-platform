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

/** One verification path for every top-up form: the chain is the judge. */
async function creditFromHash(merchantId: string, hash: string, back: string): Promise<never> {
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
    merchant_id: merchantId,
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

/** Fallback path: WL pastes the transaction hash by hand. */
export async function buyCreditsWithTx(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("settings", "view");
  const hash = String(formData.get("tx_hash") ?? "").trim();
  return creditFromHash(merchant.id, hash, "/m/credits");
}

/** Primary path: WL uploads the transfer screenshot, we read the hash off it. */
export async function buyCreditsWithScreenshot(formData: FormData): Promise<void> {
  const { merchant } = await requireMerchantUser();
  await requirePerm("settings", "view");
  const back = "/m/credits";
  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) fail(back, "Pick the transfer screenshot");
  if (file.size > 8 * 1024 * 1024) fail(back, "Screenshots must be under 8MB");

  const { aiSettings, AI_DEFAULTS } = await import("@/modules/ai/lib");
  const s = await aiSettings();
  if (!s.claude_api_key) fail(back, "Screenshot reading is not configured — paste the transaction hash instead");

  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    ? file.type
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let hash = "";
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: s.claude_api_key });
    const response = await client.messages.create({
      model: s.claude_model || AI_DEFAULTS.claude_model,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            {
              type: "text",
              text: "This is a screenshot of a TRON (TRC20) transfer. Find the transaction hash / TxID — a 64-character hexadecimal string, possibly shown truncated with … (if truncated, it is unusable). Reply with ONLY the full 64-character hash, or NONE if no complete hash is visible.",
            },
          ],
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join(" ");
    hash = (text.match(/[0-9a-fA-F]{64}/) ?? [""])[0];
  } catch {
    fail(back, "Could not read the screenshot — paste the transaction hash instead");
  }
  if (!hash) {
    fail(back, "No full transaction hash visible on the screenshot — copy the TxID from your wallet and paste it below");
  }
  return creditFromHash(merchant.id, hash, back);
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

import "server-only";
import { db } from "@/lib/supabase";
import { checkTrc20Payment } from "./tron";
import { effectiveRates } from "./fx";

// Customer-reported USDT top-ups, confirmed on chain. The flow is
// submit → verify against the chain → credit the ledger automatically;
// anything the chain can't settle waits in the admin queue.

export type TopupRequest = {
  id: string;
  merchant_id: string;
  country_id: string | null;
  customer_id: string;
  network: string;
  tx_hash: string;
  amount_usdt: number | null;
  chain_usdt: number | null;
  status: "pending" | "credited" | "rejected";
  verify_note: string | null;
  verified: unknown;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type TopupRequestRow = TopupRequest & {
  customer: { name: string; ref: string | null } | null;
};

export const TOPUP_SELECT = "*, customer:customers(name, ref)";

export async function topupRequestsFor(opts: { countryId?: string; customerId?: string; status?: string }) {
  let q = db().from("topup_requests").select(TOPUP_SELECT).order("created_at", { ascending: false });
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as unknown as TopupRequestRow[];
}

/**
 * Credit a request into the customer's ledger at today's receivable rate.
 * The status flip is the lock: only the caller that moves pending → credited
 * gets to write the ledger entry, so a hash can never be credited twice.
 */
async function credit(req: TopupRequest, usdt: number, note: string, byUserId: string | null): Promise<string | null> {
  const { data: country } = await db()
    .from("countries")
    .select("currency, usdt_markup_pct, usdt_markup_flat")
    .eq("id", req.country_id ?? "")
    .maybeSingle();
  if (!country) return "The customer has no country to price against";

  let rates;
  try {
    rates = await effectiveRates(country as { currency: string; usdt_markup_pct: number; usdt_markup_flat: number });
  } catch (e) {
    return e instanceof Error ? e.message : "No USDT rate available";
  }

  const { data: locked } = await db()
    .from("topup_requests")
    .update({
      status: "credited",
      chain_usdt: usdt,
      verify_note: note,
      reviewed_by: byUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", req.id)
    .eq("status", "pending")
    .select("id");
  if (!locked || locked.length === 0) return "Already handled";

  const credited = Math.round(usdt * rates.receivable * 100) / 100;
  const { error } = await db().from("ledger_entries").insert({
    merchant_id: req.merchant_id,
    country_id: req.country_id,
    holder_type: "customer",
    holder_id: req.customer_id,
    currency: country.currency,
    amount: credited,
    kind: "topup",
    usdt_amount: usdt,
    usdt_rate: rates.receivable,
    note: `TRC20 ${req.tx_hash}`,
    created_by: byUserId,
  });
  // The status already flipped; a failed ledger write must be visible.
  if (error) {
    await db()
      .from("topup_requests")
      .update({ verify_note: `CREDIT FAILED: ${error.message}` })
      .eq("id", req.id);
    return `Ledger write failed: ${error.message}`;
  }
  return null;
}

/**
 * Ask the chain about a pending request and act on the answer: a confirmed
 * USDT transfer to our address credits the CHAIN amount (never the reported
 * one); a definitive mismatch rejects; anything else stays pending.
 */
export async function verifyTopupRequest(
  id: string,
  byUserId: string | null
): Promise<{ status: string; note: string }> {
  const { data } = await db().from("topup_requests").select("*").eq("id", id).maybeSingle();
  const req = data as TopupRequest | null;
  if (!req) return { status: "missing", note: "Request not found" };
  if (req.status !== "pending") return { status: req.status, note: "Already handled" };

  const { data: country } = await db()
    .from("countries")
    .select("usdt_address_trc20")
    .eq("id", req.country_id ?? "")
    .maybeSingle();

  const check = await checkTrc20Payment(req.tx_hash, (country?.usdt_address_trc20 as string | null) ?? "");
  if (check.ok) {
    const err = await credit(req, check.usdt, `Confirmed on chain from ${check.from}`, byUserId);
    if (err) {
      await db().from("topup_requests").update({ verify_note: err }).eq("id", id).eq("status", "pending");
      return { status: "pending", note: err };
    }
    return { status: "credited", note: `Confirmed: ${check.usdt} USDT` };
  }

  if (check.final) {
    await db()
      .from("topup_requests")
      .update({
        status: "rejected",
        verify_note: check.reason,
        reviewed_by: byUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");
    return { status: "rejected", note: check.reason };
  }

  await db().from("topup_requests").update({ verify_note: check.reason }).eq("id", id).eq("status", "pending");
  return { status: "pending", note: check.reason };
}

/** Admin override: credit a pending request by hand when the chain check can't. */
export async function creditTopupManually(id: string, usdt: number, byUserId: string): Promise<string | null> {
  const { data } = await db().from("topup_requests").select("*").eq("id", id).maybeSingle();
  const req = data as TopupRequest | null;
  if (!req) return "Request not found";
  if (req.status !== "pending") return "Already handled";
  return credit(req, usdt, "Manually approved", byUserId);
}

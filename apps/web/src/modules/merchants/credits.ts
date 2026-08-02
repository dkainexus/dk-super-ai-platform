import "server-only";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

// Credits: the white label's prepaid right to approve submissions. Bought
// with verified USDT, spent one approval at a time, the ledger is the truth.

export type CreditConfig = {
  usdt_per_credit: number;
  credits_per_approval: number;
  usdt_address_trc20: string;
};

export type CreditEntry = {
  id: string;
  merchant_id: string;
  delta: number;
  reason: "topup" | "approval" | "manual";
  tx_hash: string | null;
  usdt_amount: number | null;
  owner_id: string | null;
  note: string | null;
  created_at: string;
};

export async function creditConfig(): Promise<CreditConfig> {
  return getSetting<CreditConfig>("credits", {
    usdt_per_credit: 10,
    credits_per_approval: 1,
    usdt_address_trc20: "",
  });
}

export async function creditBalance(merchantId: string): Promise<number> {
  const { data } = await db().from("credit_ledger").select("delta").eq("merchant_id", merchantId);
  return ((data ?? []) as { delta: number }[]).reduce((s, r) => s + r.delta, 0);
}

export async function creditLedger(merchantId: string, limit = 30): Promise<CreditEntry[]> {
  const { data } = await db()
    .from("credit_ledger")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CreditEntry[];
}

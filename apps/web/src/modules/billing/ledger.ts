import "server-only";
import { db } from "@/lib/supabase";

// Party money is a ledger of signed entries; a balance is always derived,
// never stored, so nothing can drift.

export type LedgerEntry = {
  id: string;
  holder_type: "customer" | "agent" | "merchant";
  holder_id: string;
  currency: string;
  amount: number;
  kind: "topup" | "invoice_payment" | "payout" | "adjustment";
  invoice_id: string | null;
  usdt_amount: number | null;
  usdt_rate: number | null;
  note: string | null;
  created_at: string;
};

export async function ledgerFor(
  holderType: LedgerEntry["holder_type"],
  holderId: string
): Promise<{ balance: number; currency: string | null; entries: LedgerEntry[] }> {
  const { data } = await db()
    .from("ledger_entries")
    .select("*")
    .eq("holder_type", holderType)
    .eq("holder_id", holderId)
    .order("created_at", { ascending: false });
  const entries = (data ?? []) as LedgerEntry[];
  return {
    balance: entries.reduce((s, e) => s + Number(e.amount), 0),
    currency: entries[0]?.currency ?? null,
    entries,
  };
}

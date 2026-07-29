import "server-only";
import { db } from "@/lib/supabase";

// USDT against the country's currency. One market rate is stored per day; the
// country's markup then tilts it against the counterparty in both directions —
// a customer paying us needs more USDT, an agent being paid receives fewer.

export type EffectiveRates = {
  /** Market: how many units of the currency one USDT buys today. */
  market: number;
  day: string;
  /** Applied to money coming in (customers pay at this rate). */
  receivable: number;
  /** Applied to money going out (agents are paid at this rate). */
  payable: number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Today's market rate, fetched once and stored. If the source is unreachable
 * the most recent stored day is used — a stale rate beats no invoice.
 */
export async function usdtMarketRate(currency: string): Promise<{ rate: number; day: string }> {
  const day = todayIso();
  const cur = currency.toUpperCase();

  const { data: cached } = await db()
    .from("fx_rates")
    .select("rate")
    .eq("day", day)
    .eq("currency", cur)
    .maybeSingle();
  if (cached) return { rate: Number(cached.rate), day };

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${cur.toLowerCase()}`,
      { signal: AbortSignal.timeout(8000), cache: "no-store" }
    );
    const json = (await res.json()) as { tether?: Record<string, number> };
    const rate = json.tether?.[cur.toLowerCase()];
    if (rate && rate > 0) {
      await db()
        .from("fx_rates")
        .upsert({ day, currency: cur, rate }, { onConflict: "day,currency", ignoreDuplicates: true });
      return { rate, day };
    }
  } catch {
    // fall through to the latest stored day
  }

  const { data: last } = await db()
    .from("fx_rates")
    .select("rate, day")
    .eq("currency", cur)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) throw new Error(`No USDT rate for ${cur} — the rate source is unreachable and nothing is stored yet`);
  return { rate: Number(last.rate), day: last.day as string };
}

/** The market rate with the country's markup applied both ways. */
export async function effectiveRates(country: {
  currency: string;
  usdt_markup_pct?: number | null;
  usdt_markup_flat?: number | null;
}): Promise<EffectiveRates> {
  const { rate, day } = await usdtMarketRate(country.currency);
  const pct = Number(country.usdt_markup_pct ?? 0);
  const flat = Number(country.usdt_markup_flat ?? 0);

  const round4 = (n: number) => Math.round(n * 10000) / 10000;
  return {
    market: rate,
    day,
    receivable: round4(Math.max(0.0001, rate * (1 - pct / 100) - flat)),
    payable: round4(rate * (1 + pct / 100) + flat),
  };
}

export const usdtAmount = (total: number, rate: number) => Math.round((total / rate) * 100) / 100;

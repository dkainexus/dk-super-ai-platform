import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase";
import type { CurrentUser } from "@/lib/auth";
import type { Country } from "@/lib/types";

/** Countries a white label operates in (sorted). */
export async function merchantCountries(merchantId: string): Promise<Country[]> {
  const { data } = await db()
    .from("merchant_countries")
    .select("country:countries(*)")
    .eq("merchant_id", merchantId);
  const countries = ((data ?? []) as unknown as { country: Country }[]).map((r) => r.country).filter(Boolean);
  return countries.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

/** True when the white label operates in the given country. */
export async function merchantHasCountry(merchantId: string, countryId: string): Promise<boolean> {
  const { data } = await db()
    .from("merchant_countries")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("country_id", countryId)
    .maybeSingle();
  return Boolean(data);
}

export const ACTIVE_COUNTRY_COOKIE = "dk_active_country";

/**
 * Countries this merchant user may access: the white label's countries,
 * narrowed by user_countries rows when any exist (no rows = all).
 */
export async function allowedCountries(cu: CurrentUser): Promise<Country[]> {
  if (!cu.merchant) return [];
  const all = await merchantCountries(cu.merchant.id);
  const { data } = await db().from("user_countries").select("country_id").eq("user_id", cu.user.id);
  const assigned = ((data ?? []) as { country_id: string }[]).map((r) => r.country_id);
  if (assigned.length === 0) return all;
  return all.filter((c) => assigned.includes(c.id));
}

/** The active country for the merchant portal (cookie-selected, validated). */
export async function activeCountry(cu: CurrentUser): Promise<{ active: Country | null; allowed: Country[] }> {
  const allowed = await allowedCountries(cu);
  const jar = await cookies();
  const picked = jar.get(ACTIVE_COUNTRY_COOKIE)?.value;
  const active = allowed.find((c) => c.id === picked) ?? allowed[0] ?? null;
  return { active, allowed };
}

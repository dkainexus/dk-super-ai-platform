import "server-only";
import { db } from "@/lib/supabase";
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

import "server-only";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import type { Bank, Merchant } from "@/lib/types";

/** Active banks for a country — empty when the Banks module is switched off. */
export async function banksForCountry(countryId: string, merchant: Merchant | null): Promise<Bank[]> {
  const toggles = await globalModuleToggles();
  const { data: countryRow } = await db().from("countries").select("*").eq("id", countryId).maybeSingle();
  if (!moduleEnabledFor("banks", toggles, merchant, (countryRow ?? null) as never)) return [];
  const { data } = await db()
    .from("banks")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort")
    .order("name");
  return (data ?? []) as Bank[];
}

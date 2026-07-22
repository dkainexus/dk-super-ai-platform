import "server-only";
import { db } from "./supabase";
import { globalModuleToggles, moduleEnabledFor } from "./settings";
import type { Bank, Merchant, Occupation } from "./types";

/** Active banks for a country — empty when the Banks module is switched off. */
export async function banksForCountry(countryId: string, merchant: Merchant | null): Promise<Bank[]> {
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("banks", toggles, merchant)) return [];
  const { data } = await db()
    .from("banks")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort")
    .order("name");
  return (data ?? []) as Bank[];
}

/** Active occupations for a country — empty when the Occupations module is off. */
export async function occupationsForCountry(countryId: string, merchant: Merchant | null): Promise<Occupation[]> {
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("occupations", toggles, merchant)) return [];
  const { data } = await db()
    .from("occupations")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort")
    .order("name");
  return (data ?? []) as Occupation[];
}

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

export type BankBranch = {
  id: string;
  bank_id: string;
  name: string;
  address: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Resolve a branch from a BranchPicker submission: reuse the directory entry
 * for that Google place when it exists, otherwise create it. Returns null when
 * nothing was entered.
 */
export async function resolveBranch(
  bankId: string,
  formData: FormData,
  createdBy?: string | null
): Promise<{ id: string } | null> {
  const placeId = String(formData.get("branch_place_id") ?? "").trim() || null;
  const name = String(formData.get("branch_name") ?? "").trim();
  if (!name) return null;

  if (placeId) {
    const { data: existing } = await db()
      .from("bank_branches")
      .select("id")
      .eq("bank_id", bankId)
      .eq("place_id", placeId)
      .maybeSingle();
    if (existing) return { id: existing.id };
  }

  const latRaw = String(formData.get("branch_lat") ?? "");
  const lngRaw = String(formData.get("branch_lng") ?? "");
  const { data, error } = await db()
    .from("bank_branches")
    .insert({
      bank_id: bankId,
      name,
      address: String(formData.get("branch_address") ?? "").trim() || null,
      place_id: placeId,
      lat: latRaw ? parseFloat(latRaw) : null,
      lng: lngRaw ? parseFloat(lngRaw) : null,
      created_by: createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

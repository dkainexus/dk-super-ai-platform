import "server-only";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import type { Owner } from "@/lib/types";

// Companies module config lives in app_config under key 'companies':
//   { shareholder_countries: [countryId, ...] }
// Countries in the list show the shareholders section on company forms.

export type CompaniesSettings = { shareholder_countries: string[] };

export async function companiesSettings(): Promise<CompaniesSettings> {
  const stored = await getSetting<Partial<CompaniesSettings>>("companies", {});
  return { shareholder_countries: stored.shareholder_countries ?? [] };
}

export async function shareholdersEnabledFor(countryId: string): Promise<boolean> {
  const s = await companiesSettings();
  return s.shareholder_countries.includes(countryId);
}

/** Owners of a white label that can be bound to companies (not banned). */
export async function bindableOwners(merchantId: string): Promise<Owner[]> {
  const { data } = await db()
    .from("owners")
    .select("*")
    .eq("merchant_id", merchantId)
    .neq("status", "banned")
    .order("full_name");
  return (data ?? []) as Owner[];
}

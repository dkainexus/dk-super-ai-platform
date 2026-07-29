import "server-only";
import { db } from "@/lib/supabase";
import type { Country } from "@/lib/types";

/** All IANA timezones (grouped selects get long — keep the plain list). */
export function timezoneList(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** USDT plus all ISO 4217 currency codes known to the runtime. */
export function currencyList(): string[] {
  return ["USDT", ...Intl.supportedValuesOf("currency")];
}

export const ADMIN_COUNTRY_COOKIE = "dk_admin_country";

/**
 * The platform admin's active country: everything in /admin is filtered to it.
 * `null` means "All countries".
 */
export async function adminCountry(): Promise<{ active: Country | null; all: Country[] }> {
  const { cookies } = await import("next/headers");
  const { data } = await db().from("countries").select("*").eq("active", true).order("name");
  const all = (data ?? []) as Country[];
  const jar = await cookies();
  const picked = jar.get(ADMIN_COUNTRY_COOKIE)?.value;
  return { active: all.find((c) => c.id === picked) ?? null, all };
}

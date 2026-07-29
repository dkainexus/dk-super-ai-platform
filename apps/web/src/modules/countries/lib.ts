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
export const GLOBAL_SCOPE = "global";

export type AdminScope = {
  /** "global" = the superadmin console (platform-wide settings, no operational data) */
  mode: "global" | "country";
  active: Country | null;
  all: Country[];
};

/**
 * What the platform back office is currently showing. Superadmins can sit in
 * the global console; everyone else always works inside one country.
 */
export async function adminScope(cu: { isSuper: boolean }): Promise<AdminScope> {
  const { cookies } = await import("next/headers");
  const { data } = await db().from("countries").select("*").eq("active", true).order("name");
  const all = (data ?? []) as Country[];
  const picked = (await cookies()).get(ADMIN_COUNTRY_COOKIE)?.value;

  if (picked === GLOBAL_SCOPE && cu.isSuper) return { mode: "global", active: null, all };
  const active = all.find((c) => c.id === picked) ?? null;
  if (active) return { mode: "country", active, all };
  // No valid pick yet: superadmins land in the console, everyone else in a country.
  if (cu.isSuper) return { mode: "global", active: null, all };
  return { mode: "country", active: all[0] ?? null, all };
}

/** Country-scoped pages: the active country, or null while in the console. */
export async function adminCountry(): Promise<{ active: Country | null; all: Country[] }> {
  const { getCurrentUser } = await import("@/lib/auth");
  const cu = await getCurrentUser();
  const scope = await adminScope({ isSuper: cu?.isSuper ?? false });
  return { active: scope.active, all: scope.all };
}

/** Operational pages call this: the console has no country data to show. */
export async function requireCountryScope(): Promise<{ active: Country | null; all: Country[] }> {
  const { getCurrentUser } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const cu = await getCurrentUser();
  const scope = await adminScope({ isSuper: cu?.isSuper ?? false });
  if (scope.mode === "global") redirect("/admin");
  return { active: scope.active, all: scope.all };
}

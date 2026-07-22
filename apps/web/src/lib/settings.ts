import "server-only";
import { db } from "./supabase";
import type { Country, Merchant } from "./types";

// Settings store on top of the app_config key/value table.

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from("app_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db().from("app_config").upsert({ key, value });
}

export type PlatformSettings = { name: string };

export async function platformSettings(): Promise<PlatformSettings> {
  return getSetting<PlatformSettings>("platform", { name: "DK CMS" });
}

/** Global module toggles: { owners: true, ... } (missing key = enabled). */
export async function globalModuleToggles(): Promise<Record<string, boolean>> {
  return getSetting<Record<string, boolean>>("modules", {});
}

/**
 * A module is on when globally enabled, not disabled for this merchant and
 * not disabled in the given country (pass the active country on the portal).
 */
export function moduleEnabledFor(
  moduleKey: string,
  toggles: Record<string, boolean>,
  merchant: Merchant | null,
  country?: Country | null
): boolean {
  if (toggles[moduleKey] === false) return false;
  const disabled = (merchant?.disabled_modules ?? []) as string[];
  if (disabled.includes(moduleKey)) return false;
  const countryDisabled = (country?.disabled_modules ?? []) as string[];
  return !countryDisabled.includes(moduleKey);
}

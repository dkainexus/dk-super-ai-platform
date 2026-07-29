import "server-only";
import { db } from "@/lib/supabase";

// Administrative areas. How deep the tree goes, and what each level is called,
// is a property of the country: Thailand and Malaysia have three levels,
// Australia and Vietnam two, Singapore one.

export type Region = {
  id: string;
  country_id: string;
  parent_id: string | null;
  level: number;
  name: string;
  active: boolean;
  sort: number;
};

/** Level names for a country, e.g. ["Province", "District", "Sub-district"]. */
export const DEFAULT_LEVELS = ["State / Province", "District", "Sub-district"];

export function addressLevels(country: { address_levels?: string[] | null } | null): string[] {
  const levels = country?.address_levels;
  return levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
}

export async function regionsAt(countryId: string, parentId: string | null): Promise<Region[]> {
  let q = db()
    .from("regions")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort")
    .order("name");
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data } = await q;
  return (data ?? []) as Region[];
}

/**
 * Every area of a country in one go, for the address picker: it cascades in the
 * browser, so it needs the whole tree rather than a round trip per level.
 */
export async function regionTree(countryId: string | null | undefined): Promise<Region[]> {
  if (!countryId) return [];
  const { data } = await db()
    .from("regions")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("level")
    .order("sort")
    .order("name");
  return (data ?? []) as Region[];
}

/** How many areas sit under each region — shown in the management list. */
export async function childCounts(countryId: string): Promise<Map<string, number>> {
  const { data } = await db().from("regions").select("parent_id").eq("country_id", countryId);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { parent_id: string | null }[]) {
    if (!r.parent_id) continue;
    counts.set(r.parent_id, (counts.get(r.parent_id) ?? 0) + 1);
  }
  return counts;
}

/** The chain from a region up to level 1, used for breadcrumbs. */
export async function regionPath(id: string | null): Promise<Region[]> {
  const path: Region[] = [];
  let current = id;
  while (current) {
    const { data } = await db().from("regions").select("*").eq("id", current).maybeSingle();
    if (!data) break;
    const region = data as Region;
    path.unshift(region);
    current = region.parent_id;
  }
  return path;
}

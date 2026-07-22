import "server-only";
import { db } from "@/lib/supabase";
import type { Occupation } from "@/lib/types";

/** Global active occupations list (shared by all countries). */
export async function occupationsList(): Promise<Occupation[]> {
  const { data } = await db()
    .from("occupations")
    .select("*")
    .eq("active", true)
    .order("sort")
    .order("name");
  return (data ?? []) as Occupation[];
}

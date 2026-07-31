import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";

// Live availability probe for the Branding subdomain field. Reserved names
// stay ours; everything else is a simple uniqueness check that ignores the
// caller's own current subdomain.
const RESERVED = new Set(["www", "api", "admin", "app", "portal", "mail", "cdn", "static", "dk", "dkgg"]);

export async function GET(req: Request) {
  const cu = await getCurrentUser();
  if (!cu?.merchant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const v = (new URL(req.url).searchParams.get("v") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(v)) {
    return NextResponse.json({ available: false, reason: "3–30 characters: lowercase letters, digits, hyphens" });
  }
  if (RESERVED.has(v)) return NextResponse.json({ available: false, reason: "Reserved" });

  const { data } = await db()
    .from("merchants")
    .select("id")
    .eq("subdomain", v)
    .neq("id", cu.merchant.id)
    .maybeSingle();
  return NextResponse.json({ available: !data, reason: data ? "Already taken" : undefined });
}

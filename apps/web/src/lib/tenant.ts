import "server-only";
import { headers } from "next/headers";
import { db } from "./supabase";
import type { Merchant } from "./types";

/**
 * Resolves the merchant whose branding this request's Host belongs to:
 * exact custom_domain match first, then first DNS label vs merchants.subdomain
 * (works under any base domain, e.g. merchant-a.cms.example.com).
 */
export async function tenantFromHost(): Promise<Merchant | null> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || /^[0-9.]+$/.test(host)) return null;

  const { data: byDomain } = await db()
    .from("merchants")
    .select("*")
    .eq("custom_domain", host)
    .eq("status", "active")
    .maybeSingle();
  if (byDomain) return byDomain as Merchant;

  const sub = host.split(".")[0];
  if (!sub) return null;
  const { data } = await db()
    .from("merchants")
    .select("*")
    .eq("subdomain", sub)
    .eq("status", "active")
    .maybeSingle();
  return (data as Merchant) ?? null;
}

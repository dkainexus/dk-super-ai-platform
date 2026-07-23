import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./supabase";
import { env } from "./env";
import type { Country, Merchant, Owner } from "./types";

// Bearer-token auth for the mobile app (owners). Signed with the same
// SESSION_SECRET as web sessions but a distinct `kind`, so tokens are not
// interchangeable with staff/merchant cookies.

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type AppOwner = Owner & { merchant: Merchant; country: Country };

function key(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret());
}

export async function signOwnerToken(ownerId: string): Promise<string> {
  return new SignJWT({ oid: ownerId, kind: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

/** Owner for a Bearer token, or null when missing/invalid/blocked. */
export async function ownerFromRequest(req: Request): Promise<AppOwner | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  let ownerId: string | null = null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind !== "owner") return null;
    ownerId = (payload.oid as string) ?? null;
  } catch {
    return null;
  }
  if (!ownerId) return null;

  const { data } = await db()
    .from("owners")
    .select("*, merchant:merchants(*), country:countries(*)")
    .eq("id", ownerId)
    .maybeSingle();
  const owner = data as AppOwner | null;
  if (!owner) return null;
  if (owner.status === "banned") return null;
  if (!owner.app_username || !owner.app_password_hash) return null; // access revoked
  if (owner.merchant?.status !== "active") return null;
  return owner;
}

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const COOKIE = "dk_super_ai_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionKind = "staff" | "merchant";
export type Session = { uid: string; kind: SessionKind };

function key(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret());
}

export async function createSession(uid: string, kind: SessionKind = "staff"): Promise<void> {
  const token = await new SignJWT({ uid, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const uid = (payload.uid as string) ?? null;
    if (!uid) return null;
    const kind: SessionKind = payload.kind === "merchant" ? "merchant" : "staff";
    return { uid, kind };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

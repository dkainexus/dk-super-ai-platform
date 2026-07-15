import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const COOKIE = "dk_super_ai_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret());
}

export async function createSession(staffId: string): Promise<void> {
  const token = await new SignJWT({ uid: staffId })
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

export async function readSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return (payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

import "server-only";
import { cookies, headers } from "next/headers";
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

  // `secure` only when actually served over HTTPS: the site currently runs on
  // plain http://<ip>:3000, where browsers silently DROP Secure cookies
  // (localhost is exempt, which is why local tests pass). Once TLS terminates
  // at a proxy that sets x-forwarded-proto, this flips to secure automatically.
  const h = await headers();
  const isHttps = h.get("x-forwarded-proto") === "https";

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
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

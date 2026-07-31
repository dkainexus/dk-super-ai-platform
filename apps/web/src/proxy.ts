import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Request log (shows up in `pm2 logs dk-web`), plus the one-address rule:
// after sign-in everyone lives under /admin. Partner (merchant) sessions get
// their console served there — /admin/* is rewritten to the /m/* pages — and
// any old /m link bounces to its /admin twin so the URL never shows /m.

const COOKIE = "dk_super_ai_session";

async function sessionKind(req: NextRequest): Promise<"staff" | "merchant" | null> {
  const token = req.cookies.get(COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.kind === "merchant" ? "merchant" : "staff";
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for") ?? "direct";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 60);
  const action = req.headers.get("next-action");
  console.log(
    `[req] ${new Date().toISOString()} ${req.method} ${pathname}${action ? ` action=${action.slice(0, 8)}` : ""} ip=${ip} ua=${ua}`
  );

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/m" || pathname.startsWith("/m/")) {
    const kind = await sessionKind(req);
    if (kind === "merchant") {
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        const url = req.nextUrl.clone();
        url.pathname = pathname === "/admin" ? "/m" : pathname.replace(/^\/admin/, "/m");
        return NextResponse.rewrite(url);
      }
      if (pathname !== "/m/login") {
        const url = req.nextUrl.clone();
        url.pathname = pathname === "/m" ? "/admin" : pathname.replace(/^\/m/, "/admin");
        return NextResponse.redirect(url);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/change-password", "/admin", "/admin/:path*", "/m", "/m/:path*", "/"],
};

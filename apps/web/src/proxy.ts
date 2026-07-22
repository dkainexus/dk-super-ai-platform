import { NextRequest, NextResponse } from "next/server";

// Lightweight request log for auth debugging: shows up in `pm2 logs dk-web`.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for") ?? "direct";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 60);
  const action = req.headers.get("next-action");
  console.log(
    `[req] ${new Date().toISOString()} ${req.method} ${pathname}${action ? ` action=${action.slice(0, 8)}` : ""} ip=${ip} ua=${ua}`
  );
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/change-password", "/admin/:path*", "/m/:path*", "/"],
};

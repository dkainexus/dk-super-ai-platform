"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Pull-to-refresh is disabled, so freshness is automatic instead: the server
// data re-fetches when the app comes back to the foreground and on a quiet
// 30-second heartbeat while visible. router.refresh() re-renders the server
// components in place — no full reload, scroll and form state survive.
const HEARTBEAT_MS = 30_000;

export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, pathname]);

  return null;
}

"use client";

import { useEffect } from "react";

// Registers the app-shell service worker once the page is interactive.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

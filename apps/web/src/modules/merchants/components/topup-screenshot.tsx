"use client";

import { useRef, useState } from "react";
import { buyCreditsWithScreenshot } from "@/modules/merchants/credit-actions";

// The primary top-up gesture: pick the wallet's transfer screenshot, we read
// the TxID off it and verify on chain — one tap, no typing.
export function TopupScreenshot() {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form ref={formRef} action={buyCreditsWithScreenshot}>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? "Reading & verifying…" : "📷 Upload transfer screenshot"}
        <input
          name="screenshot"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={() => {
            setBusy(true);
            formRef.current?.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}

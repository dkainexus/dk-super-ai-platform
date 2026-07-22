"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="input mono-num flex-1 text-xs" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // clipboard may be unavailable (http); the input stays selectable
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent"
      >
        {copied ? "已复制 ✓" : "复制"}
      </button>
    </div>
  );
}

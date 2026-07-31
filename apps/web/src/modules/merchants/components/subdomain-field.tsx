"use client";

import { useEffect, useRef, useState } from "react";

type Check = { state: "idle" | "checking" | "available" | "taken"; reason?: string };

// Subdomain input with a live availability verdict — save is the server's
// final word, this is the instant feedback the user asked for.
export function SubdomainField({ defaultValue, suffix }: { defaultValue: string; suffix: string }) {
  const [value, setValue] = useState(defaultValue);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const v = value.trim().toLowerCase();
    if (!v || v === defaultValue) {
      setCheck({ state: "idle" });
      return;
    }
    setCheck({ state: "checking" });
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/subdomain/check?v=${encodeURIComponent(v)}`);
        const j = (await r.json()) as { available?: boolean; reason?: string };
        setCheck(j.available ? { state: "available" } : { state: "taken", reason: j.reason });
      } catch {
        setCheck({ state: "idle" });
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, defaultValue]);

  return (
    <div>
      <label className="mb-1 block text-xs text-muted">Subdomain</label>
      <div className="flex items-center gap-2">
        <input
          name="subdomain"
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          placeholder="my-brand"
          autoComplete="off"
          className="input mono-num flex-1"
        />
        <span className="mono-num shrink-0 text-xs text-muted">.{suffix}</span>
      </div>
      <p className="mt-1.5 min-h-4 text-xs">
        {check.state === "checking" && <span className="text-muted">Checking…</span>}
        {check.state === "available" && <span className="text-success">✓ Available</span>}
        {check.state === "taken" && <span className="text-danger">✗ {check.reason ?? "Already taken"}</span>}
        {check.state === "idle" && value === defaultValue && defaultValue && (
          <span className="text-muted">This is your current subdomain.</span>
        )}
      </p>
    </div>
  );
}

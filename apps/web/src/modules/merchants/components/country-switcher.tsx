"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { switchActiveCountry } from "@/modules/merchants/actions-merchant";

type CountryOpt = { id: string; name: string; flag: string | null };

// Active-country selector for the white label portal sidebar. Always visible:
// with a single country it's a static pill; with several it opens a styled
// popover. Switching submits a server action that sets the cookie and does a
// full redirect back to the current page — no stale client cache.
export function CountrySwitcher({ countries, activeId }: { countries: CountryOpt[]; activeId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = countries.find((c) => c.id === activeId) ?? countries[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!active) return null;
  const multiple = countries.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => multiple && setOpen((v) => !v)}
        title={multiple ? "Switch the active country" : "Your active country"}
        className={`flex w-full items-center gap-2 rounded-lg border border-border bg-surface-raised/60 px-3 py-2 text-sm transition-colors ${
          multiple ? "cursor-pointer hover:border-accent" : "cursor-default"
        }`}
      >
        <span className="text-base leading-none">{active.flag || "🌐"}</span>
        <span className="min-w-0 flex-1 truncate text-left font-medium">{active.name}</span>
        {multiple && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {open && multiple && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <p className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted">
            Country
          </p>
          {countries.map((c) => (
            <form key={c.id} action={switchActiveCountry}>
              <input type="hidden" name="country_id" value={c.id} />
              <input type="hidden" name="path" value={pathname} />
              <button
                type="submit"
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  c.id === active.id
                    ? "bg-accent-soft font-medium text-accent-strong"
                    : "text-foreground hover:bg-surface-raised"
                }`}
              >
                <span className="text-base leading-none">{c.flag || "🌐"}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.id === active.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// Active-country selector for the platform admin sidebar. Picking a country
// scopes every /admin page to it; "All countries" shows everything.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { switchAdminCountry } from "../actions";

type CountryOpt = { id: string; name: string; flag: string | null };

export function AdminCountrySwitcher({
  countries,
  activeId,
}: {
  countries: CountryOpt[];
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = countries.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const option = (id: string, label: string, flag: string | null, current: boolean) => (
    <form key={id || "all"} action={switchAdminCountry}>
      <input type="hidden" name="country_id" value={id} />
      <input type="hidden" name="path" value={pathname} />
      <button
        type="submit"
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-soft ${
          current ? "text-accent-strong" : "text-foreground"
        }`}
      >
        <span className="text-base leading-none">{flag ?? "🌐"}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {current && <span className="text-xs">✓</span>}
      </button>
    </form>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Scope the whole back office to one country"
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-raised/60 px-3 py-2 text-sm transition-colors hover:border-accent"
      >
        <span className="text-base leading-none">{active?.flag ?? "🌐"}</span>
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {active?.name ?? "All countries"}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {option("", "All countries", null, active === null)}
          {countries.map((c) => option(c.id, c.name, c.flag, c.id === activeId))}
        </div>
      )}
    </div>
  );
}

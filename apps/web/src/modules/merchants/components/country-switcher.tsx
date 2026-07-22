"use client";

import { useRef } from "react";
import { switchActiveCountry } from "@/modules/merchants/actions-merchant";

// Active-country switcher for the white label portal top bar. Auto-submits
// on change; the whole portal (dashboard, lists, creation) follows it.
export function CountrySwitcher({
  countries,
  activeId,
}: {
  countries: { id: string; name: string; flag: string | null }[];
  activeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  if (countries.length <= 1) return null;

  return (
    <form ref={formRef} action={switchActiveCountry}>
      <select
        name="country_id"
        defaultValue={activeId}
        title="Switch the active country — dashboard and lists follow it"
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
      >
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.flag || "🌐"} {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}

"use client";

// Branch picker: type a branch name, pick from Google Places, and the
// standardised name/address/coordinates go into the form as hidden fields.

import { useEffect, useRef, useState } from "react";

type Suggestion = { place_id: string; name: string; address: string };

export function BranchPicker({
  regionCode,
  label = "Branch (search Google Maps)",
  compact,
}: {
  /** ISO-3166 alpha-2 of the bank's country, e.g. TH */
  regionCode?: string | null;
  label?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{
    place_id: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setItems([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/places/search?q=${encodeURIComponent(query)}${regionCode ? `&region=${regionCode}` : ""}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search failed");
        setItems(json.suggestions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, regionCode, picked]);

  async function choose(s: Suggestion) {
    setBusy(true);
    setItems([]);
    try {
      const res = await fetch(`/api/places/search?place_id=${encodeURIComponent(s.place_id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      setPicked(json);
      setQuery(json.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = compact ? "input py-1.5 text-xs" : "input";

  return (
    <div className="relative">
      <label className={`mb-1 block ${compact ? "text-[10px] uppercase tracking-wide" : "text-xs"} text-muted`}>
        {label}
      </label>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
        }}
        placeholder="e.g. Kasikorn Bank Siam Paragon"
        className={inputClass}
        autoComplete="off"
      />
      {busy && <p className="mt-1 text-[11px] text-muted">Searching…</p>}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      {picked && (
        <p className="mt-1 text-[11px] text-success">✓ {picked.address}</p>
      )}

      {items.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full min-w-72 overflow-auto rounded-lg border border-border bg-surface-raised shadow-xl">
          {items.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => choose(s)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-accent-soft"
              >
                <span className="block text-sm">{s.name}</span>
                <span className="block text-[11px] text-muted">{s.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input type="hidden" name="branch_place_id" value={picked?.place_id ?? ""} />
      <input type="hidden" name="branch_name" value={picked?.name ?? query} />
      <input type="hidden" name="branch_address" value={picked?.address ?? ""} />
      <input type="hidden" name="branch_lat" value={picked?.lat ?? ""} />
      <input type="hidden" name="branch_lng" value={picked?.lng ?? ""} />
    </div>
  );
}

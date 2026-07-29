"use client";

// The address area fields for one country. How many there are and what they are
// called comes from the country itself — Singapore has one level, Australia and
// Vietnam two, Thailand and Malaysia three. Each level offers the areas that sit
// inside the one above; a level with nothing configured yet accepts free text so
// the form is never a dead end.

import { useMemo, useState } from "react";

export type RegionNode = { id: string; parent_id: string | null; level: number; name: string };

/** The three columns owners and companies store the picked names in. */
const FIELD_NAMES = ["province", "district", "subdistrict"] as const;

export function AddressPicker({
  levels,
  regions,
  values = [],
  disabled,
}: {
  levels: string[];
  regions: RegionNode[];
  /** Saved names, widest first. */
  values?: (string | null | undefined)[];
  disabled?: boolean;
}) {
  const depth = Math.min(levels.length, FIELD_NAMES.length);
  const [picked, setPicked] = useState<string[]>(() =>
    Array.from({ length: depth }, (_, i) => values[i] ?? "")
  );

  const byParent = useMemo(() => {
    const map = new Map<string, RegionNode[]>();
    for (const r of regions) {
      const key = r.parent_id ?? "root";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [regions]);

  // Resolve each level's options by walking down from the names already chosen.
  const options: RegionNode[][] = [];
  let parentId: string | null = null;
  for (let i = 0; i < depth; i++) {
    const list: RegionNode[] = byParent.get(parentId ?? "root") ?? [];
    options.push(list);
    const match: RegionNode | undefined = list.find((r) => r.name === picked[i]);
    parentId = match?.id ?? null;
    if (!match) {
      for (let j = i + 1; j < depth; j++) options.push([]);
      break;
    }
  }

  const set = (i: number, value: string) =>
    setPicked((prev) => prev.map((v, j) => (j === i ? value : j > i ? "" : v)));

  return (
    <>
      {Array.from({ length: depth }, (_, i) => {
        const list = options[i] ?? [];
        return (
          <div key={FIELD_NAMES[i]}>
            <label className="mb-1 block text-xs text-muted">{levels[i]}</label>
            {list.length > 0 ? (
              <select
                name={FIELD_NAMES[i]}
                value={picked[i]}
                onChange={(e) => set(i, e.target.value)}
                className="input"
                disabled={disabled}
              >
                <option value="">— Select —</option>
                {/* A saved name that is no longer on the list stays selectable. */}
                {(picked[i] && !list.some((r) => r.name === picked[i]) ? [picked[i]] : []).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                {list.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            ) : (
              <input
                name={FIELD_NAMES[i]}
                value={picked[i]}
                onChange={(e) => set(i, e.target.value)}
                placeholder={i === 0 ? levels[i] : `Type the ${levels[i].toLowerCase()}`}
                className="input"
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
      {/* Unused columns are cleared so a country that shrinks its levels stays clean. */}
      {FIELD_NAMES.slice(depth).map((n) => (
        <input key={n} type="hidden" name={n} value="" />
      ))}
    </>
  );
}

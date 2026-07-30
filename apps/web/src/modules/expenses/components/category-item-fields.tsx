"use client";

import { useState } from "react";

type Cat = { id: string; name: string };
type Item = { category_id: string; name: string };

// Category select + item box for the expense form. Picking a category swaps
// the item suggestions to its presets; the item stays free text underneath —
// suggestions help, they never restrict.
export function CategoryItemFields({ categories, items }: { categories: Cat[]; items: Item[] }) {
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const suggestions = items.filter((i) => i.category_id === catId);
  const selected = categories.find((c) => c.id === catId);

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted">Category</label>
        <select
          name="category"
          className="input"
          required
          value={selected?.name ?? ""}
          onChange={(e) => setCatId(categories.find((c) => c.name === e.target.value)?.id ?? "")}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Item (what was bought)</label>
        <input
          name="item"
          className="input"
          list="expense-item-presets"
          placeholder="pick a preset or type freely"
          autoComplete="off"
        />
        <datalist id="expense-item-presets">
          {suggestions.map((i) => (
            <option key={i.name} value={i.name} />
          ))}
        </datalist>
      </div>
    </>
  );
}

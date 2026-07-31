"use client";

import { useState } from "react";

type Cat = { id: string; name: string };
type Item = { category_id: string; name: string };

// Category select + item dropdown for the expense form. The item list shows
// only the picked category's library; "+ New item…" opens a text box, and
// whatever is typed there joins the library on submit.
export function CategoryItemFields({ categories, items }: { categories: Cat[]; items: Item[] }) {
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [choice, setChoice] = useState("");
  const options = items.filter((i) => i.category_id === catId);
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
          onChange={(e) => {
            setCatId(categories.find((c) => c.name === e.target.value)?.id ?? "");
            setChoice("");
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Item</label>
        <select
          name={choice === "__new__" ? undefined : "item"}
          className="input"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">— none —</option>
          {options.map((i) => (
            <option key={i.name} value={i.name}>{i.name}</option>
          ))}
          <option value="__new__">+ New item…</option>
        </select>
      </div>
      {choice === "__new__" && (
        <div>
          <label className="mb-1 block text-xs text-muted">New item (saved to the library)</label>
          <input name="item" className="input" placeholder="e.g. iPhone 15" autoFocus required />
        </div>
      )}
    </>
  );
}

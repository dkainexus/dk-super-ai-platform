"use client";

// Cascading owner picker for Manual Credit: Country → White Label → Owner.

import { useMemo, useState } from "react";

export type PickerOwner = {
  id: string;
  name: string;
  merchant_id: string;
  merchant_name: string;
  country_id: string | null;
  country_name: string;
};

export function OwnerPicker({ owners }: { owners: PickerOwner[] }) {
  const [country, setCountry] = useState("");
  const [merchant, setMerchant] = useState("");

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of owners) if (o.country_id) map.set(o.country_id, o.country_name);
    return [...map.entries()];
  }, [owners]);

  const merchants = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of owners) {
      if (country && o.country_id !== country) continue;
      map.set(o.merchant_id, o.merchant_name);
    }
    return [...map.entries()];
  }, [owners, country]);

  const list = owners.filter(
    (o) => (!country || o.country_id === country) && (!merchant || o.merchant_id === merchant)
  );

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted">Country</label>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setMerchant("");
          }}
          className="input"
        >
          <option value="">All countries</option>
          {countries.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">White Label</label>
        <select value={merchant} onChange={(e) => setMerchant(e.target.value)} className="input">
          <option value="">All white labels</option>
          {merchants.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Owner</label>
        <select name="owner_id" className="input" required>
          <option value="">— Select an owner —</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.merchant_name})
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

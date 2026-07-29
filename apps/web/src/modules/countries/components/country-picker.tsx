"use client";

import { useState } from "react";
import { COUNTRY_DATA, flagOf } from "@/modules/countries/data";

// Add Country picker: pick the country and everything else follows — name,
// code, flag and timezone come from the dataset; only the currency is a choice.
export function CountryPicker({ currencies }: { currencies: string[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tz, setTz] = useState("UTC");
  const [currency, setCurrency] = useState("USD");

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="flag" value={code ? flagOf(code) : ""} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="timezone" value={tz} />

      <div>
        <label className="mb-1 block text-xs text-muted">
          Country{tz !== "UTC" ? <span className="text-muted"> · {tz}</span> : null}
        </label>
        <select
          required
          value={code}
          onChange={(e) => {
            const c = COUNTRY_DATA.find((x) => x.code === e.target.value);
            setCode(e.target.value);
            if (c) {
              setName(c.name);
              setTz(c.tz);
              setCurrency(c.currency);
            }
          }}
          className="input"
        >
          <option value="">— Select a country —</option>
          {COUNTRY_DATA.map((c) => (
            <option key={c.code} value={c.code}>
              {flagOf(c.code)} {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Currency</label>
        <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="input mono-num">
          {currencies.map((cur) => (
            <option key={cur} value={cur}>
              {cur}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { COUNTRY_DATA, flagOf } from "@/modules/countries/data";

// Add Country picker: choose the country from the dataset — code and flag are
// filled automatically, timezone and currency default to the country's own
// (both stay editable). Name is prefilled but editable (e.g. bilingual names).
export function CountryPicker({ timezones, currencies }: { timezones: string[]; currencies: string[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tz, setTz] = useState("UTC");
  const [currency, setCurrency] = useState("USD");

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_7rem]">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="flag" value={code ? flagOf(code) : ""} />

      <div>
        <label className="mb-1 block text-xs text-muted">Country *</label>
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
        <label className="mb-1 block text-xs text-muted">Display Name (editable)</label>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Timezone</label>
        <select name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} className="input">
          {timezones.map((t) => (
            <option key={t} value={t}>
              {t}
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

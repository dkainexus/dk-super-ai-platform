"use client";

import { useState } from "react";

export type OwnerOption = { id: string; name: string; companyType: string | null };

/** Owner binding + company type. Picking an owner suggests its occupation's
 *  company type when the type field is still empty. */
export function OwnerTypePicker({
  owners,
  ownerId,
  companyType,
}: {
  owners: OwnerOption[];
  ownerId: string;
  companyType: string;
}) {
  const [type, setType] = useState(companyType);

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted">Bound Owner *</label>
        <select
          name="owner_id"
          defaultValue={ownerId}
          required
          className="input"
          onChange={(e) => {
            const o = owners.find((x) => x.id === e.target.value);
            if (o?.companyType && !type) setType(o.companyType);
          }}
        >
          <option value="">— Select an owner —</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.companyType ? ` (${o.companyType})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Company Type (suggested by the owner&apos;s occupation)</label>
        <input
          name="company_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="e.g. Limited Company"
          className="input"
        />
      </div>
    </>
  );
}

export type ShareholderRow = { ownerId: string; percent: string };

/** Dynamic shareholder rows — only rendered for countries with shareholders
 *  enabled. Field names sh_owner_<i> / sh_percent_<i> are parsed server-side. */
export function ShareholderRows({
  owners,
  initial,
}: {
  owners: OwnerOption[];
  initial: ShareholderRow[];
}) {
  const [rows, setRows] = useState<ShareholderRow[]>(initial.length ? initial : []);
  const total = rows.reduce((sum, r) => sum + (parseFloat(r.percent) || 0), 0);

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Shareholder {i + 1}</label>
            <select
              name={`sh_owner_${i}`}
              value={r.ownerId}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, ownerId: e.target.value } : x)))}
              className="input"
            >
              <option value="">— Select an owner —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Share %</label>
            <input
              name={`sh_percent_${i}`}
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={r.percent}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))}
              className="input mono-num"
            />
          </div>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            title="Remove this shareholder"
            className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRows([...rows, { ownerId: "", percent: "" }])}
          title="Add a shareholder row"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-foreground"
        >
          + Add Shareholder
        </button>
        {rows.length > 0 && (
          <span className={`text-xs ${total > 100 ? "text-danger" : "text-muted"}`}>
            Total: {total.toFixed(2)}% {total > 100 && "— cannot exceed 100%"}
          </span>
        )}
      </div>
    </div>
  );
}

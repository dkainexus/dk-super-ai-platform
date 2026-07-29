"use client";

import { createContext, useContext, useMemo, useState } from "react";

// The chosen white label decides which owners can be bound, and the two
// controls sit in different parts of the form, so they share it through context.
const ScopeContext = createContext<{ merchantId: string; setMerchantId: (id: string) => void }>({
  merchantId: "",
  setMerchantId: () => {},
});

export function CompanyScope({ initial, children }: { initial: string; children: React.ReactNode }) {
  const [merchantId, setMerchantId] = useState(initial);
  return <ScopeContext.Provider value={{ merchantId, setMerchantId }}>{children}</ScopeContext.Provider>;
}

/** The white label the company belongs to — the first thing you choose. */
export function WhiteLabelField({
  merchants,
  defaultValue,
}: {
  merchants: { id: string; name: string }[];
  defaultValue: string;
}) {
  const { merchantId, setMerchantId } = useContext(ScopeContext);
  const value = merchantId || defaultValue;

  return (
    <div>
      <label className="mb-1 block text-xs text-muted">White Label *</label>
      <select
        name="merchant_id"
        value={value}
        onChange={(e) => setMerchantId(e.target.value)}
        className="input"
        required
      >
        <option value="">— Select a white label —</option>
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}

export type OwnerOption = { id: string; name: string; companyType: string | null; ref?: string | null; merchantId?: string };

/** Owner binding + company type. Picking an owner suggests its occupation's
 *  company type when the type field is still empty. */
export function OwnerTypePicker({
  owners,
  ownerId,
  companyType,
  types,
  scoped = false,
}: {
  owners: OwnerOption[];
  ownerId: string;
  companyType: string;
  /** Company types configured for this country; empty = free text. */
  types: string[];
  /** True when a white label is chosen on this form — the pool follows it. */
  scoped?: boolean;
}) {
  const [type, setType] = useState(companyType);
  const { merchantId: merchant } = useContext(ScopeContext);
  const pool = scoped ? owners.filter((o) => !merchant || o.merchantId === merchant) : owners;

  return (
    <>
      <OwnerSearch
        key={merchant}
        owners={pool}
        ownerId={ownerId}
        onPick={(o) => {
          if (o?.companyType && !type) setType(o.companyType);
        }}
      />
      <div>
        <label className="mb-1 block text-xs text-muted">Company Type (suggested by the owner&apos;s occupation)</label>
        {types.length > 0 ? (
          <select name="company_type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="">— Select a type —</option>
            {(types.includes(type) || !type ? types : [type, ...types]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <input
            name="company_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. Limited Company — add types under Companies → Company Types"
            className="input"
          />
        )}
      </div>
    </>
  );
}

/** Type-to-search owner picker — the pool is far too long for a dropdown. */
function OwnerSearch({
  owners,
  ownerId,
  onPick,
}: {
  owners: OwnerOption[];
  ownerId: string;
  onPick: (owner: OwnerOption | null) => void;
}) {
  const [picked, setPicked] = useState<OwnerOption | null>(owners.find((o) => o.id === ownerId) ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? owners.filter((o) => o.name.toLowerCase().includes(q) || (o.ref ?? "").toLowerCase().includes(q))
      : owners;
    return pool.slice(0, 30);
  }, [owners, query]);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs text-muted">Bound Owner *</label>
      <input type="hidden" name="owner_id" value={picked?.id ?? ""} required />
      {picked ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <span className="flex-1 text-sm">
            {picked.name}
            {picked.ref && <span className="mono-num ml-2 text-xs text-muted">{picked.ref}</span>}
          </span>
          <button
            type="button"
            title="Pick a different owner"
            onClick={() => {
              setPicked(null);
              onPick(null);
              setOpen(true);
            }}
            className="text-xs text-muted hover:text-foreground"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search an owner by name or reference number…"
          className="input"
        />
      )}

      {open && !picked && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {matches.length === 0 && <p className="px-3 py-3 text-xs text-muted">No owner matches.</p>}
          {matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setPicked(o);
                onPick(o);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-raised"
            >
              <span className="flex-1">
                {o.name}
                {o.companyType ? <span className="ml-2 text-xs text-muted">({o.companyType})</span> : null}
              </span>
              {o.ref && <span className="mono-num text-[11px] text-muted">{o.ref}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
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

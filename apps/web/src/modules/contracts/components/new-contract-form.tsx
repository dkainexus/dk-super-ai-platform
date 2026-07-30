"use client";

// Who the contract is with decides which fields matter, so the form reshapes
// itself as the kind is picked.

import { useMemo, useState } from "react";
import { createContract } from "../actions";
import { SubmitButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";

export type PartyOption = { id: string; label: string; merchant: string };

// Only customer contracts are written by hand now: owner terms live on the
// owner, agent conditions on the agent, and both wire in at activation.
const KINDS = [{ value: "customer", label: "Customer", hint: "they pay us rent" }] as const;

export function NewContractForm({
  customers,
  agents,
  owners,
}: {
  customers: PartyOption[];
  agents: PartyOption[];
  owners: PartyOption[];
}) {
  const [kind, setKind] = useState<"customer" | "agent" | "owner">("customer");
  const [query, setQuery] = useState("");
  const [partyId, setPartyId] = useState("");

  const pool = kind === "customer" ? customers : kind === "agent" ? agents : owners;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? pool.filter((p) => p.label.toLowerCase().includes(q)) : pool).slice(0, 30);
  }, [pool, query]);
  const picked = pool.find((p) => p.id === partyId) ?? null;

  return (
    <form action={createContract} className="card space-y-5 p-5">
      <input type="hidden" name="party_type" value={kind} />
      <input type="hidden" name="party_id" value={partyId} />

      <div>
        <label className="mb-1 block text-xs text-muted">Contract With</label>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => {
                setKind(k.value);
                setPartyId("");
                setQuery("");
              }}
              title={k.hint}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                kind === k.value
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <label className="mb-1 block text-xs text-muted">
          {kind === "customer" ? "Customer" : kind === "agent" ? "Agent" : "Owner"} *
        </label>
        {picked ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="flex-1 text-sm">
              {picked.label} <span className="text-xs text-muted">· {picked.merchant}</span>
            </span>
            <button
              type="button"
              onClick={() => setPartyId("")}
              title="Pick someone else"
              className="text-xs text-muted hover:text-foreground"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or reference…"
              autoComplete="off"
              className="input"
            />
            <div className="mt-1 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {matches.length === 0 && <p className="px-3 py-3 text-xs text-muted">Nobody matches.</p>}
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPartyId(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-raised"
                >
                  <span className="flex-1">{p.label}</span>
                  <span className="text-[11px] text-muted">{p.merchant}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Minimum Term (months)</label>
          <input name="min_term_months" type="number" min={1} defaultValue={3} className="input mono-num" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Renewal Minimum (months)</label>
          <input name="renewal_min_months" type="number" min={1} defaultValue={3} className="input mono-num" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Renewal Window (days before expiry)</label>
          <input name="renewal_window_days" type="number" min={1} defaultValue={30} className="input mono-num" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Lead Days (binding → billing)</label>
          <input name="lead_days" type="number" min={0} defaultValue={14} className="input mono-num" />
        </div>
        {kind !== "owner" && (
          <div>
            <label className="mb-1 block text-xs text-muted">Deposit (written, not collected)</label>
            <MoneyInput name="deposit" defaultValue={0} />
          </div>
        )}
        {kind === "agent" && (
          <div>
            <label className="mb-1 block text-xs text-muted">Theft Liability Window (months)</label>
            <input name="theft_window_months" type="number" min={0} defaultValue={6} className="input mono-num" />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Notes</label>
        <textarea name="notes" rows={2} className="input" />
      </div>

      <SubmitButton label="Create Contract" />
    </form>
  );
}

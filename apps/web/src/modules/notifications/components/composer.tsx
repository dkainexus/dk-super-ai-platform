"use client";

import { useMemo, useState } from "react";
import { sendNotification } from "../actions";
import { ActionButton } from "@/components/action-buttons";

export type ComposerOwner = { id: string; name: string; merchantId: string; ref: string | null };
export type ComposerMerchant = { id: string; name: string };

// Pick the white label first, then send to everyone in it or to a hand-picked
// list of owners found by typing a name or reference number.
export function NotificationComposer({
  merchants,
  owners,
  countryId,
  lockedMerchantId,
}: {
  merchants: ComposerMerchant[];
  owners: ComposerOwner[];
  countryId: string;
  /** White-label side: the brand is fixed and the selector is hidden. */
  lockedMerchantId?: string;
}) {
  const [merchantId, setMerchantId] = useState(lockedMerchantId ?? "");
  const [specific, setSpecific] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const inBrand = useMemo(
    () => owners.filter((o) => !merchantId || o.merchantId === merchantId),
    [owners, merchantId]
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? inBrand.filter((o) => o.name.toLowerCase().includes(q) || (o.ref ?? "").toLowerCase().includes(q))
      : inBrand;
    return base.slice(0, 50);
  }, [inBrand, query]);

  const pickedOwners = owners.filter((o) => picked.includes(o.id));
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <form action={sendNotification} className="card space-y-4 p-5">
      <input type="hidden" name="country_id" value={countryId} />
      <input type="hidden" name="merchant_id" value={merchantId} />
      {picked.map((id) => (
        <input key={id} type="hidden" name="owner_ids" value={id} />
      ))}

      <h2 className="text-sm font-semibold">Send notification</h2>

      {!lockedMerchantId && (
        <div>
          <label className="mb-1 block text-xs text-muted">White Label</label>
          <select
            value={merchantId}
            onChange={(e) => {
              setMerchantId(e.target.value);
              setPicked([]);
            }}
            className="input"
          >
            <option value="">All white labels</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-muted">Audience</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSpecific(false)}
            title="Everyone in the selected white label"
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !specific
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            All owners ({inBrand.length})
          </button>
          <button
            type="button"
            onClick={() => setSpecific(true)}
            title="Choose the owners yourself"
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              specific
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            Specific owners{picked.length > 0 ? ` (${picked.length})` : ""}
          </button>
        </div>
      </div>

      {specific && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or reference number…"
            className="input"
          />
          {pickedOwners.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pickedOwners.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  title={`Remove ${o.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-xs text-accent-strong hover:border-danger/60 hover:text-danger"
                >
                  {o.name} <span className="text-muted">✕</span>
                </button>
              ))}
            </div>
          )}
          <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {matches.length === 0 && <p className="px-3 py-4 text-xs text-muted">No owners match.</p>}
            {matches.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-raised">
                <input
                  type="checkbox"
                  checked={picked.includes(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="flex-1">{o.name}</span>
                {o.ref && <span className="mono-num text-[11px] text-muted">{o.ref}</span>}
              </label>
            ))}
          </div>
          {inBrand.length > matches.length && !query && (
            <p className="text-[11px] text-muted">
              Showing the first {matches.length} of {inBrand.length} — type to narrow it down.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Title</label>
          <input name="title" className="input" placeholder="e.g. Your company has been registered 🎉" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Message</label>
          <textarea name="body" rows={3} className="input" placeholder="Optional details" />
        </div>
      </div>

      <ActionButton
        icon="send"
        tip={
          specific
            ? `Send to the ${picked.length} owner${picked.length === 1 ? "" : "s"} you picked`
            : "Send to everyone in this audience"
        }
        label="Send"
        variant="primary"
      />
    </form>
  );
}

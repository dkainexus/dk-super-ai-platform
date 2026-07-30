import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { saveMerchantCountries, saveSettlementSettings } from "@/modules/merchants/actions";
import { recordMerchantTopUp } from "@/modules/billing/actions";
import { ledgerFor } from "@/modules/billing/ledger";
import { fmtNum } from "@/lib/format";
import { MoneyInput } from "@/components/money-input";
import { ActionButton } from "@/components/action-buttons";
import { UserCountriesCard } from "@/modules/merchants/components/user-countries";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SaveButton } from "@/components/action-buttons";
import type { Country, Merchant, Role, User } from "@/lib/types";

// Console-side white label: which countries the brand operates in, and which of
// those each team member may work in. Both are platform decisions, so they live
// here rather than inside a country.
export default async function ConsoleWhiteLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("merchants", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const [{ data: merchant }, { data: allCountries }, { data: links }, { data: users }] = await Promise.all([
    db().from("merchants").select("*").eq("id", id).maybeSingle(),
    db().from("countries").select("*").order("sort").order("name"),
    db().from("merchant_countries").select("country_id, escort_threshold").eq("merchant_id", id),
    db().from("users").select("*, role:roles(*)").eq("merchant_id", id).order("username"),
  ]);
  if (!merchant) notFound();
  const m = merchant as Merchant;

  const enabledIds = new Set(((links ?? []) as { country_id: string }[]).map((l) => l.country_id));
  const thresholds = new Map(
    ((links ?? []) as { country_id: string; escort_threshold: number | null }[]).map((l) => [
      l.country_id,
      l.escort_threshold,
    ])
  );
  const wallet = await ledgerFor("merchant", m.id);
  const quote = Number((m as Merchant & { company_quote?: number }).company_quote ?? 0);
  const minCompanies = Number((m as Merchant & { min_prepaid_companies?: number }).min_prepaid_companies ?? 0);
  const minRequired = (minCompanies * quote) / 2;
  const countries = (allCountries ?? []) as Country[];
  const enabled = countries.filter((c) => enabledIds.has(c.id));
  const canEdit = Boolean(can(cu, "merchants", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/white-labels" className="text-xs text-muted hover:text-foreground">← White Labels</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{m.name}</h1>
          <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
          {m.code && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{m.code}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Brand details and modules are edited inside a country — this page decides where the brand operates.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Countries</h2>
        <p className="mb-4 text-xs text-muted">
          Which countries this white label operates in. A country holding owners or companies cannot be removed.
        </p>
        <form action={saveMerchantCountries} className="space-y-3">
          <input type="hidden" name="merchant_id" value={m.id} />
          <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
          <div className="grid gap-2 sm:grid-cols-2">
            {countries.map((c) => (
              <label
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 transition-colors hover:border-accent"
              >
                <span className="text-sm">
                  {c.flag || "🌐"} {c.name} <span className="mono-num text-xs text-muted">{c.code}</span>
                </span>
                <span className="flex items-center gap-3">
                  {enabledIds.has(c.id) && (
                    <input
                      name={`et_${c.id}`}
                      defaultValue={thresholds.get(c.id) ?? ""}
                      placeholder="Escort threshold"
                      title="Above this account balance the owner is never sent to the bank alone"
                      className="input w-36 py-1 text-xs mono-num"
                      disabled={!canEdit}
                    />
                  )}
                  <input
                    type="checkbox"
                    name={`mc_${c.id}`}
                    defaultChecked={enabledIds.has(c.id)}
                    disabled={!canEdit}
                    className="h-4 w-4"
                  />
                </span>
              </label>
            ))}
          </div>
          {canEdit && <SaveButton tip="Save the countries this white label operates in" />}
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Settlement Settings</h2>
        <p className="mb-4 text-xs text-muted">
          Our dividend on each account&apos;s asking-price profit, the flat fee when they use an account
          themselves, and the company economics: we quote the full figure, their wallet funds half at registration.
        </p>
        <form action={saveSettlementSettings} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <input type="hidden" name="merchant_id" value={m.id} />
          <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
          <div>
            <label className="mb-1 block text-xs text-muted">Our profit share %</label>
            <input
              name="profit_share_pct"
              defaultValue={Number((m as Merchant & { profit_share_pct?: number }).profit_share_pct ?? 50)}
              className="input mono-num"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Own-use flat fee / month</label>
            <MoneyInput name="own_use_fee" defaultValue={Number((m as Merchant & { own_use_fee?: number }).own_use_fee ?? 0)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Company quote (they fund half)</label>
            <MoneyInput name="company_quote" defaultValue={quote} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Minimum prepaid companies</label>
            <input name="min_prepaid_companies" type="number" min={0} defaultValue={minCompanies} className="input mono-num" disabled={!canEdit} />
          </div>
          {canEdit && (
            <div className="sm:col-span-full">
              <SaveButton tip="Save the settlement settings" />
            </div>
          )}
        </form>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Wallet</h2>
            {minRequired > 0 && (
              <p className={`mt-1 text-xs ${wallet.balance < minRequired ? "text-danger" : "text-muted"}`}>
                Minimum to keep: {fmtNum(minRequired)} ({minCompanies} companies × {fmtNum(quote / 2)})
                {wallet.balance < minRequired && " — below it, their agents cannot register companies"}
              </p>
            )}
          </div>
          <p className="mono-num text-lg font-semibold">{fmtNum(wallet.balance)} THB</p>
        </div>
        {canEdit && (
          <form action={recordMerchantTopUp} className="mb-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <input type="hidden" name="merchant_id" value={m.id} />
            <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
            <div>
              <label className="mb-1 block text-xs text-muted">Amount received (THB)</label>
              <MoneyInput name="amount" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Note</label>
              <input name="note" className="input mono-num" />
            </div>
            <ActionButton icon="plus" tip="Credit their wallet" label="Record Top-Up" variant="primary" />
          </form>
        )}
        <div className="divide-y divide-border">
          {wallet.entries.length === 0 && <p className="py-3 text-sm text-muted">No activity yet.</p>}
          {wallet.entries.slice(0, 12).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-muted">{e.note ?? e.kind}</span>
              <span className={`mono-num ${Number(e.amount) >= 0 ? "text-success" : "text-danger"}`}>
                {Number(e.amount) >= 0 ? "+" : ""}
                {fmtNum(e.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <UserCountriesCard
        users={((users ?? []) as (User & { role: Role | null })[]).map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
        }))}
        countries={enabled}
        back={`/admin/white-labels/${m.id}`}
      />
    </div>
  );
}

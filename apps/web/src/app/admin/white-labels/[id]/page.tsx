import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  saveMerchantCountries,
  saveSettlementSettings,
  createMerchantUser,
  resetMerchantUserPassword,
  toggleMerchantUser,
} from "@/modules/merchants/actions";
import { recordMerchantTopUp } from "@/modules/billing/actions";
import { adjustCredits } from "@/modules/merchants/credit-actions";
import { creditBalance, creditLedger } from "@/modules/merchants/credits";
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
  const [credits, creditRows] = await Promise.all([creditBalance(m.id), creditLedger(m.id, 8)]);
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

      {/* Credits: what lets them approve agent submissions */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Credits</h2>
            <p className="mt-1 text-xs text-muted">
              Approving an agent submission spends credits; they buy more with USDT on their Credits page.
            </p>
          </div>
          <p className="mono-num text-lg font-semibold">{credits} credits</p>
        </div>
        {canEdit && (
          <form action={adjustCredits} className="mb-4 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <input type="hidden" name="merchant_id" value={m.id} />
            <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
            <div>
              <label className="mb-1 block text-xs text-muted">Credits (± to deduct)</label>
              <input name="delta" type="number" className="input mono-num" placeholder="10" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Note</label>
              <input name="note" className="input" />
            </div>
            <ActionButton icon="plus" tip="Apply the adjustment to their credit ledger" label="Adjust" variant="outline" />
          </form>
        )}
        <div className="divide-y divide-border">
          {creditRows.length === 0 && <p className="py-2 text-sm text-muted">No credit activity yet.</p>}
          {creditRows.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-muted">
                {e.reason === "topup" ? `Top-up${e.usdt_amount != null ? ` (${e.usdt_amount} USDT)` : ""}` : e.reason === "approval" ? "Approval" : e.note ?? "Adjustment"}
              </span>
              <span className={`mono-num ${e.delta >= 0 ? "text-success" : "text-danger"}`}>
                {e.delta >= 0 ? "+" : ""}
                {e.delta}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Accounts: the brand's sign-ins — reset, disable, create */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Accounts</h2>
        <p className="mb-4 text-xs text-muted">
          The white label&apos;s sign-ins. Resetting a password forces them to choose a new one at next login.
        </p>
        <div className="space-y-3">
          {((users ?? []) as (User & { role: Role | null })[]).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name || u.username} <span className="mono-num font-normal text-muted">{u.username}</span>
                </p>
                <p className="text-xs text-muted">{u.role?.name ?? "No role"}</p>
              </div>
              <ActiveTag active={u.active} on="Enabled" off="Disabled" />
              {can(cu, "users", "edit") && (
                <>
                  <form action={resetMerchantUserPassword} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
                    <input
                      name="password"
                      type="text"
                      placeholder="new password"
                      className="input w-40 py-1.5 text-sm mono-num"
                      autoComplete="off"
                      required
                    />
                    <ActionButton icon="key" tip="Set this password — they must change it at next login" label="Reset" variant="outline" />
                  </form>
                  <form action={toggleMerchantUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
                    <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                    <ActionButton icon="power" tip={u.active ? "Disable this sign-in" : "Enable this sign-in"} variant="outline" />
                  </form>
                </>
              )}
            </div>
          ))}
          {(users ?? []).length === 0 && <p className="text-sm text-muted">No sign-ins yet — create the first below.</p>}
        </div>

        {can(cu, "users", "add") && (
          <form action={createMerchantUser} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="merchant_id" value={m.id} />
            <input type="hidden" name="back" value={`/admin/white-labels/${m.id}`} />
            <div>
              <label className="mb-1 block text-xs text-muted">Username</label>
              <input name="username" className="input" autoComplete="off" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">First password</label>
              <input name="password" type="text" className="input mono-num" autoComplete="off" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Display name</label>
              <input name="name" className="input" />
            </div>
            <ActionButton icon="plus" tip="Create a Partner Administrator sign-in" label="Add Account" variant="primary" />
          </form>
        )}
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { updateCountry, toggleCountryModule, addPaymentChannel, removePaymentChannel } from "@/modules/countries/actions";
import { timezoneList, currencyList } from "@/modules/countries/lib";
import { TOGGLABLE_MODULES } from "@/modules/registry";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, Merchant } from "@/lib/types";
import { ToggleButton } from "@/components/toggle-button";

export default async function CountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("countries", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data: country } = await db().from("countries").select("*").eq("id", id).maybeSingle();
  if (!country) notFound();
  const c = country as Country;

  const { data: mcRows } = await db()
    .from("merchant_countries")
    .select("merchant:merchants(*, users(count), owners(count))")
    .eq("country_id", id);
  const merchants = ((mcRows ?? []) as unknown as { merchant: Merchant & { users: { count: number }[]; owners: { count: number }[] } }[])
    .map((r) => r.merchant)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/countries" className="text-xs text-muted hover:text-foreground">
          ← Countries
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {c.flag || "🌐"} {c.name} <span className="mono-num text-sm text-muted">{c.code}</span>
        </h1>
        <p className="mt-1 text-xs text-muted">
          <span className="rounded-full bg-surface-raised px-2 py-0.5">{c.timezone}</span>{" "}
          <span className="mono-num rounded-full bg-surface-raised px-2 py-0.5">{c.currency}</span>
        </p>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Country settings ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Country Settings</h2>
        <div className="card p-5">
          <form action={updateCountry} className="grid gap-4 sm:grid-cols-[1fr_5rem_1fr_7rem_auto] sm:items-end">
            <input type="hidden" name="id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input name="name" defaultValue={c.name} className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Flag</label>
              <input name="flag" defaultValue={c.flag ?? ""} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Timezone</label>
              <select name="timezone" defaultValue={c.timezone} className="input">
                {timezoneList().map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Currency</label>
              <select name="currency" defaultValue={c.currency} className="input mono-num">
                {currencyList().map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>
            </div>
            <SaveButton tip="Save country settings" />
          </form>
        </div>
      </section>

      {/* ---------- Payment channels ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Payment Channels</h2>
        <div className="card p-5">
          <p className="mb-4 text-xs text-muted">
            Channels available in {c.name} (e.g. PromptPay, MoMo, QR Pay). Banks in this country tick the ones they
            support, and account submissions only offer the ticked channels.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(c.payment_channels ?? []).length === 0 && (
              <p className="text-sm text-muted">No channels yet.</p>
            )}
            {(c.payment_channels ?? []).map((ch) => (
              <form key={ch} action={removePaymentChannel} className="inline-flex">
                <input type="hidden" name="country_id" value={c.id} />
                <input type="hidden" name="channel" value={ch} />
                <button
                  type="submit"
                  title={`Remove ${ch} from this country`}
                  className="group inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent-strong transition-colors hover:border-danger/60 hover:text-danger"
                >
                  {ch} <span className="text-muted group-hover:text-danger">✕</span>
                </button>
              </form>
            ))}
          </div>
          <form action={addPaymentChannel} className="flex max-w-sm items-end gap-3">
            <input type="hidden" name="country_id" value={c.id} />
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">New Channel</label>
              <input name="channel" placeholder="e.g. PromptPay" className="input" required />
            </div>
            <ActionButton icon="plus" tip="Add this payment channel" label="Add" variant="primary" />
          </form>
        </div>
      </section>

      {/* ---------- Modules in this country ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Modules in {c.name}</h2>
        <div className="card p-5">
          <p className="mb-4 text-xs text-muted">
            Which business modules run in this country. A switched-off module disappears from the white label portal
            when this country is active (globally-off modules stay off regardless).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOGGLABLE_MODULES.map((mod) => {
              const on = !(c.disabled_modules ?? []).includes(mod.key);
              return (
                <form
                  key={mod.key}
                  action={toggleCountryModule}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 transition-colors hover:border-accent"
                >
                  <input type="hidden" name="country_id" value={c.id} />
                  <input type="hidden" name="key" value={mod.key} />
                  <input type="hidden" name="on" value={on ? "0" : "1"} />
                  <span className="text-sm">{mod.name}</span>
                  <ToggleButton on={on} name={`${mod.name} in ${c.name}`} />
                </form>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}

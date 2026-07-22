import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createMerchant } from "@/modules/merchants/actions";
import { updateCountry } from "@/modules/countries/actions";
import { timezoneList, currencyList } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, Merchant } from "@/lib/types";

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
          <form action={updateCountry} className="grid gap-4 sm:grid-cols-[1fr_5rem_1fr_7rem_6rem_auto] sm:items-end">
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
            <div>
              <label className="mb-1 block text-xs text-muted">Sort</label>
              <input name="sort" type="number" defaultValue={c.sort} className="input mono-num" />
            </div>
            <SaveButton tip="Save country settings" />
          </form>
        </div>
      </section>

      {/* ---------- White Labels ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">White Labels</h2>
        <div className="card divide-y divide-border">
          {merchants.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No white labels in this country yet.</p>
          )}
          {merchants.map(
            (m) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.subdomain ? `${m.subdomain}.***` : "no subdomain"} · {m.users?.[0]?.count ?? 0} account(s) ·{" "}
                    {m.owners?.[0]?.count ?? 0} owner(s)
                  </p>
                </div>
                <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
              </Link>
            )
          )}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">Create White Label + Login Account</h3>
          <form action={createMerchant} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">White Label Name</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Subdomain (optional, lowercase a-z 0-9 -)</label>
              <input name="subdomain" placeholder="brand-a" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Login Username</label>
              <input name="username" autoComplete="off" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Initial Password (must be changed at first login)</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" required />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="Create White Label" />
            </div>
          </form>
        </div>
      </section>

      {/* Custom fields now live under Owners module settings */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Owner Custom Fields</h2>
        <Link
          href={`/admin/settings/owners?country=${c.id}`}
          className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          Manage {c.name} custom fields in Owners Module Settings →
        </Link>
      </section>
    </div>
  );
}

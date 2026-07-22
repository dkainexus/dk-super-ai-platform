import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createCountry, toggleCountry } from "@/modules/countries/actions";
import { timezoneList, currencyList } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import type { Country } from "@/lib/types";

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("countries", "view");
  const { error } = await searchParams;

  const { data: countries } = await db()
    .from("countries")
    .select("*, merchants(count), country_fields(count)")
    .order("sort")
    .order("created_at");

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Countries</h1>
      <p className="text-sm text-muted">
        A country is a workspace: it carries the timezone and currency for its region and holds its white labels.
      </p>
      <ErrorBanner message={error} />

      <div className="card divide-y divide-border">
        {(countries ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">No countries yet — create the first one below.</p>
        )}
        {(countries ?? []).map((c: Country & { merchants: { count: number }[]; country_fields: { count: number }[] }) => (
          <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <Link href={`/admin/countries/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-accent-strong">
              <span className="text-2xl">{c.flag || "🌐"}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {c.name} <span className="mono-num text-xs text-muted">{c.code}</span>
                </p>
                <p className="text-xs text-muted">
                  {c.merchants?.[0]?.count ?? 0} white label(s) · {c.timezone} · {c.currency}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <ActiveTag active={c.active} />
              <form action={toggleCountry}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground">
                  {c.active ? "Disable" : "Enable"}
                </button>
              </form>
              <Link
                href={`/admin/countries/${c.id}`}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-accent-strong"
              >
                Manage →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Add Country</h2>
        <form action={createCountry} className="grid gap-4 sm:grid-cols-[7rem_1fr_5rem_1fr_7rem_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">Code (ISO)</label>
            <input name="code" placeholder="TH" maxLength={2} className="input mono-num uppercase" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" placeholder="Thailand" className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Flag</label>
            <input name="flag" placeholder="🇹🇭" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Timezone</label>
            <select name="timezone" defaultValue="Asia/Bangkok" className="input">
              {timezoneList().map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Currency</label>
            <select name="currency" defaultValue="THB" className="input mono-num">
              {currencyList().map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </select>
          </div>
          <SubmitButton label="Add Country" />
        </form>
      </section>
    </div>
  );
}

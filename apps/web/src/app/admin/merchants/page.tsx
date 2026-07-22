import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createMerchant } from "@/modules/merchants/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import type { Country, Merchant } from "@/lib/types";

// White label directory: every tenant with its countries, plus creation
// (pick the countries here — creation no longer lives on the country page).
export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("merchants", "view");
  const { error } = await searchParams;

  const [{ data: merchants }, { data: countries }, { data: mcRows }] = await Promise.all([
    db().from("merchants").select("*, users(count), owners(count), companies(count)").order("name"),
    db().from("countries").select("*").order("sort").order("name"),
    db().from("merchant_countries").select("merchant_id, country_id"),
  ]);
  const countryById = new Map(((countries ?? []) as Country[]).map((c) => [c.id, c]));
  const countriesOf = new Map<string, Country[]>();
  for (const r of (mcRows ?? []) as { merchant_id: string; country_id: string }[]) {
    const c = countryById.get(r.country_id);
    if (!c) continue;
    const list = countriesOf.get(r.merchant_id) ?? [];
    list.push(c);
    countriesOf.set(r.merchant_id, list);
  }

  type Row = Merchant & { users: { count: number }[]; owners: { count: number }[]; companies: { count: number }[] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">White Labels</h1>
        <p className="mt-1 text-sm text-muted">
          Every white label tenant on the platform — its countries, accounts and data.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="card divide-y divide-border">
        {(merchants ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">No white labels yet — create the first one below.</p>
        )}
        {((merchants ?? []) as Row[]).map((m) => (
          <Link
            key={m.id}
            href={`/admin/merchants/${m.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{m.name}</p>
              <p className="truncate text-xs text-muted">
                {(countriesOf.get(m.id) ?? []).map((c) => `${c.flag || "🌐"} ${c.name}`).join(" · ") || "no countries"} ·{" "}
                {m.users?.[0]?.count ?? 0} account(s) · {m.owners?.[0]?.count ?? 0} owner(s) ·{" "}
                {m.companies?.[0]?.count ?? 0} compan(ies)
              </p>
            </div>
            <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
          </Link>
        ))}
      </div>

      {can(cu, "merchants", "add") && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Create White Label + Login Account</h2>
          <form action={createMerchant} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <div>
              <p className="mb-2 text-xs text-muted">Countries (at least one — more can be added later)</p>
              <div className="flex flex-wrap gap-3">
                {((countries ?? []) as Country[]).map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-accent">
                    <input type="checkbox" name={`mcc_${c.id}`} className="h-4 w-4" />
                    {c.flag || "🌐"} {c.name}
                  </label>
                ))}
              </div>
            </div>
            <SubmitButton label="Create White Label" />
          </form>
        </section>
      )}
    </div>
  );
}

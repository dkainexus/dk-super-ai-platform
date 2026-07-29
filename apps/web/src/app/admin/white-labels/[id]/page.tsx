import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { saveMerchantCountries } from "@/modules/merchants/actions";
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
    db().from("merchant_countries").select("country_id").eq("merchant_id", id),
    db().from("users").select("*, role:roles(*)").eq("merchant_id", id).order("username"),
  ]);
  if (!merchant) notFound();
  const m = merchant as Merchant;

  const enabledIds = new Set(((links ?? []) as { country_id: string }[]).map((l) => l.country_id));
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
                <input
                  type="checkbox"
                  name={`mc_${c.id}`}
                  defaultChecked={enabledIds.has(c.id)}
                  disabled={!canEdit}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>
          {canEdit && <SaveButton tip="Save the countries this white label operates in" />}
        </form>
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

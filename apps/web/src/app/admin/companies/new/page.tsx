import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bindableOwners, shareholdersEnabledFor } from "@/modules/companies/lib";
import { merchantCountries } from "@/modules/merchants/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { ErrorBanner } from "@/components/error-banner";
import type { Merchant, Occupation } from "@/lib/types";

// Three-step create: white label → country → company form. The country
// decides the shareholders section and, later, filtering.
export default async function AdminNewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; country?: string; error?: string }>;
}) {
  await requirePerm("companies", "add");
  const { merchant: merchantId = "", country: countryParam = "", error } = await searchParams;

  const { data: merchants } = await db().from("merchants").select("*").eq("status", "active").order("name");
  const list = (merchants ?? []) as Merchant[];
  const selected = list.find((m) => m.id === merchantId) ?? null;

  const countries = selected ? await merchantCountries(selected.id) : [];
  const country = countries.find((c) => c.id === countryParam) ?? (countries.length === 1 ? countries[0] : null);

  const [owners, shareholdersEnabled, { data: occupations }] =
    selected && country
      ? await Promise.all([
          bindableOwners(selected.id),
          shareholdersEnabledFor(country.id),
          db().from("occupations").select("*"),
        ])
      : [[], false, { data: [] }];

  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/companies" className="text-xs text-muted hover:text-foreground">
          ← Companies
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Company</h1>
      </div>
      <ErrorBanner message={error} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">1. Choose White Label</h2>
        <div className="flex flex-wrap gap-2">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/admin/companies/new?merchant=${m.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                merchantId === m.id
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {m.name}
            </Link>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">No active white labels yet.</p>}
        </div>
      </section>

      {selected && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">2. Choose Country</h2>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <Link
                key={c.id}
                href={`/admin/companies/new?merchant=${selected.id}&country=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  country?.id === c.id
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-muted hover:border-accent hover:text-foreground"
                }`}
              >
                {c.flag || "🌐"} {c.name}
              </Link>
            ))}
            {countries.length === 0 && (
              <p className="text-sm text-muted">This white label has no countries enabled yet.</p>
            )}
          </div>
        </section>
      )}

      {selected && country && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">
            3. Company Details — {selected.name} · {country.flag || "🌐"} {country.name}
          </h2>
          {owners.length === 0 ? (
            <p className="text-sm text-muted">
              This white label has no owners yet — a company must be bound to an owner.{" "}
              <Link href={`/admin/owners/new?merchant=${selected.id}&country=${country.id}`} className="text-accent-strong underline">
                Create an owner first →
              </Link>
            </p>
          ) : (
            <CompanyForm
              owners={owners}
              occupationTypeByOwner={typeByOwner}
              shareholdersEnabled={shareholdersEnabled}
              hidden={{ merchant_id: selected.id, country_id: country.id }}
            />
          )}
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bindableOwners, shareholdersEnabledFor, companyTypeNames } from "@/modules/companies/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { ErrorBanner } from "@/components/error-banner";
import type { Occupation } from "@/lib/types";

// Two steps: white label → company form. The country is the one you are
// working in, so it is never asked for here.
export default async function AdminNewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; error?: string }>;
}) {
  await requirePerm("companies", "add");
  const { merchant: merchantId = "", error } = await searchParams;
  const { active: country } = await requireCountryScope();
  if (!country) return null;

  const { data: merchants } = await db()
    .from("merchants")
    .select("id, name, merchant_countries(country_id)")
    .eq("status", "active")
    .order("name");
  const list = ((merchants ?? []) as unknown as {
    id: string;
    name: string;
    merchant_countries: { country_id: string }[];
  }[]).filter((m) => m.merchant_countries.some((c) => c.country_id === country.id));
  const selected = list.find((m) => m.id === merchantId) ?? (list.length === 1 ? list[0] : null);

  const [owners, shareholdersEnabled, companyTypes, { data: occupations }] = selected
    ? await Promise.all([
        bindableOwners(selected.id),
        shareholdersEnabledFor(country.id),
        companyTypeNames(country.id),
        db().from("occupations").select("*"),
      ])
    : [[], false, [] as string[], { data: [] }];

  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(
    owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null])
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/companies" className="text-xs text-muted hover:text-foreground">← Companies</Link>
        <h1 className="mt-1 text-xl font-semibold">New Company</h1>
        <p className="mt-1 text-sm text-muted">
          Registered in {country.flag || "🌐"} {country.name} — switch country in the sidebar to file elsewhere.
        </p>
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
                selected?.id === m.id
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {m.name}
            </Link>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-muted">No active white label operates in {country.name} yet.</p>
          )}
        </div>
      </section>

      {selected && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">2. Company Details — {selected.name}</h2>
          {owners.length === 0 ? (
            <p className="text-sm text-muted">
              This white label has no owners yet — a company must be bound to an owner.{" "}
              <Link href={`/admin/owners/new?merchant=${selected.id}`} className="text-accent-strong underline">
                Create an owner first →
              </Link>
            </p>
          ) : (
            <CompanyForm
              owners={owners}
              occupationTypeByOwner={typeByOwner}
              shareholdersEnabled={shareholdersEnabled}
              companyTypes={companyTypes}
              hidden={{ merchant_id: selected.id, country_id: country.id }}
            />
          )}
        </section>
      )}
    </div>
  );
}

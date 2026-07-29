import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bindableOwners, shareholdersEnabledFor, companyTypeNames } from "@/modules/companies/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { ErrorBanner } from "@/components/error-banner";
import type { Occupation } from "@/lib/types";

// One form. The country is the one you are working in, and the white label is
// a field on the form itself.
export default async function AdminNewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("companies", "add");
  const { error } = await searchParams;
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
  const [owners, shareholdersEnabled, companyTypes, { data: occupations }, { data: provinceRows }] =
    await Promise.all([
      bindableOwners(list.map((m) => m.id)),
      shareholdersEnabledFor(country.id),
      companyTypeNames(country.id),
      db().from("occupations").select("*"),
      db().from("provinces").select("name").eq("country_id", country.id).eq("active", true).order("sort"),
    ]);
  const provinces = ((provinceRows ?? []) as { name: string }[]).map((p) => p.name);

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

      {owners.length === 0 ? (
        <p className="card px-5 py-6 text-sm text-muted">
          {list.length === 0
            ? `No active white label operates in ${country.name} yet.`
            : "No owners to bind yet — a company must be bound to an owner."}{" "}
          <Link href="/admin/owners/new" className="text-accent-strong underline">Create an owner first →</Link>
        </p>
      ) : (
        <section className="card p-5">
          <CompanyForm
            owners={owners}
            occupationTypeByOwner={typeByOwner}
            shareholdersEnabled={shareholdersEnabled}
            companyTypes={companyTypes}
            provinces={provinces}
            merchants={list.map((m) => ({ id: m.id, name: m.name }))}
            hidden={{ country_id: country.id }}
          />
        </section>
      )}
    </div>
  );
}

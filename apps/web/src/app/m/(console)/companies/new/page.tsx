import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { regionTree, addressLevels } from "@/modules/countries/regions";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { bindableOwners, shareholdersEnabledFor, companyTypeNames } from "@/modules/companies/lib";
import { activeCountry } from "@/modules/merchants/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { ErrorBanner } from "@/components/error-banner";
import type { Occupation } from "@/lib/types";

export default async function MerchantNewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("companies", "add");
  if (!cu.merchant) redirect("/admin/companies/new");
  const { active: country, allowed } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("companies", toggles, cu.merchant, country)) redirect("/m");
  const { error } = await searchParams;

  const [owners, shareholdersEnabled, companyTypes, { data: occupations }] = country
    ? await Promise.all([
        bindableOwners(cu.merchant.id),
        shareholdersEnabledFor(country.id),
          companyTypeNames(country.id),
        db().from("occupations").select("*"),
      ])
    : [[], false, [] as string[], { data: [] }, { data: [] }];
  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));

  const { data: addrCountry } = await db()
    .from("countries")
    .select("address_levels")
    .eq("id", country?.id ?? "")
    .maybeSingle();
  const regions = await regionTree(country?.id ?? "");
  const levels = addressLevels(addrCountry as { address_levels?: string[] | null } | null);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/companies" className="text-xs text-muted hover:text-foreground">
          ← Companies
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Company</h1>
      </div>
      <ErrorBanner message={error} />

      {allowed.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">
          No countries enabled for your account yet — contact your administrator.
        </p>
      )}

      {country && (
      <div className="card p-5">
        {allowed.length > 1 && (
          <p className="mb-3 text-xs text-muted">
            Creating in {country.flag || "🌐"} {country.name} — switch country from the top bar.
          </p>
        )}
        {owners.length === 0 ? (
          <p className="text-sm text-muted">
            You need at least one owner first — a company must be bound to an owner.{" "}
            <Link href="/m/owners/new" className="text-accent-strong underline">
              Create an owner →
            </Link>
          </p>
        ) : (
          <CompanyForm
            owners={owners}
            occupationTypeByOwner={typeByOwner}
            shareholdersEnabled={shareholdersEnabled}
            companyTypes={companyTypes}
            levels={levels}
            regions={regions}
            hidden={{ country_id: country.id }}
          />
        )}
      </div>
      )}
    </div>
  );
}

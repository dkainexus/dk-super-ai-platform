import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { bindableOwners, shareholdersEnabledFor } from "@/modules/companies/lib";
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
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("companies", toggles, cu.merchant)) redirect("/m");
  const { error } = await searchParams;

  const [owners, shareholdersEnabled, { data: occupations }] = await Promise.all([
    bindableOwners(cu.merchant.id),
    shareholdersEnabledFor(cu.merchant.country_id),
    db().from("occupations").select("*"),
  ]);
  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/companies" className="text-xs text-muted hover:text-foreground">
          ← Companies
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Company</h1>
      </div>
      <ErrorBanner message={error} />

      <div className="card p-5">
        {owners.length === 0 ? (
          <p className="text-sm text-muted">
            You need at least one owner first — a company must be bound to an owner.{" "}
            <Link href="/m/owners/new" className="text-accent-strong underline">
              Create an owner →
            </Link>
          </p>
        ) : (
          <CompanyForm owners={owners} occupationTypeByOwner={typeByOwner} shareholdersEnabled={shareholdersEnabled} />
        )}
      </div>
    </div>
  );
}

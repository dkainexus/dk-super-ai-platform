import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { bindableOwners, shareholdersEnabledFor } from "@/modules/companies/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { deleteCompany } from "@/modules/companies/actions";
import { ErrorBanner } from "@/components/error-banner";
import { CompanyStatusTag } from "@/components/status-tag";
import { ActionButton } from "@/components/action-buttons";
import type { Company, CompanyMember, Occupation } from "@/lib/types";

export default async function MerchantCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu, scope } = await requirePerm("companies", "view");
  if (!cu.merchant) redirect("/admin/companies");
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("companies", toggles, cu.merchant)) redirect("/m");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db().from("companies").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const company = data as Company;
  if (company.merchant_id !== cu.merchant.id) notFound();
  if (scope === "own" && company.created_by !== cu.user.id) notFound();

  const [members, owners, shareholdersEnabled, { data: occupations }] = await Promise.all([
    db().from("company_members").select("*").eq("company_id", id).then((r) => (r.data ?? []) as CompanyMember[]),
    bindableOwners(cu.merchant.id),
    shareholdersEnabledFor(company.country_id),
    db().from("occupations").select("*"),
  ]);
  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));
  const canEdit = Boolean(can(cu, "companies", "edit"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/m/companies" className="text-xs text-muted hover:text-foreground">
            ← Companies
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{company.name}</h1>
            <CompanyStatusTag status={company.status} />
          </div>
        </div>
        {can(cu, "companies", "delete") && (
          <form action={deleteCompany}>
            <input type="hidden" name="id" value={company.id} />
            <ActionButton icon="trash" tip="Delete this company and its member bindings" label="Delete" variant="danger" />
          </form>
        )}
      </div>
      <ErrorBanner message={error} />

      <div className="card p-5">
        {canEdit ? (
          <CompanyForm
            owners={owners}
            occupationTypeByOwner={typeByOwner}
            company={company}
            members={members}
            shareholdersEnabled={shareholdersEnabled}
          />
        ) : (
          <p className="text-sm text-muted">You have view-only access to companies.</p>
        )}
      </div>
    </div>
  );
}

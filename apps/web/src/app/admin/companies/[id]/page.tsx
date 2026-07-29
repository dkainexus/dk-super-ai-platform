import { AuditLine } from "@/components/audit-line";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { bindableOwners, shareholdersEnabledFor, companyTypeNames } from "@/modules/companies/lib";
import { CompanyForm } from "@/modules/companies/components/company-form";
import { deleteCompany } from "@/modules/companies/actions";
import { ErrorBanner } from "@/components/error-banner";
import { CompanyStatusTag } from "@/components/status-tag";
import { ActionButton } from "@/components/action-buttons";
import type { Company, CompanyMember, Merchant, Occupation } from "@/lib/types";

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("companies", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db()
    .from("companies")
    .select("*, merchant:merchants(*), country:countries(name, flag)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const company = data as Company & { merchant: Merchant; country: { name: string; flag: string | null } };

  const [members, owners, shareholdersEnabled, companyTypes, { data: provinceRows }, { data: occupations }] = await Promise.all([
    db().from("company_members").select("*").eq("company_id", id).then((r) => (r.data ?? []) as CompanyMember[]),
    bindableOwners(company.merchant_id),
    shareholdersEnabledFor(company.country_id),
    companyTypeNames(company.country_id),
        db().from("provinces").select("name").eq("country_id", company.country_id ?? "").eq("active", true).order("sort"),
    db().from("occupations").select("*"),
  ]);
  const occupationType = new Map(((occupations ?? []) as Occupation[]).map((o) => [o.id, o.company_type]));
  const typeByOwner = new Map(owners.map((o) => [o.id, o.occupation_id ? occupationType.get(o.occupation_id) ?? null : null]));
  const canEdit = can(cu, "companies", "edit");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/companies" className="text-xs text-muted hover:text-foreground">
            ← Companies
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{company.name}</h1>
            <CompanyStatusTag status={company.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {company.country?.flag} {company.country?.name} · {company.merchant?.name}
          </p>
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
            companyTypes={companyTypes}
            provinces={((provinceRows ?? []) as { name: string }[]).map((p) => p.name)}
          />
        ) : (
          <p className="text-sm text-muted">You have view-only access to companies.</p>
        )}
      </div>

      <AuditLine
        createdBy={(company as { created_by?: string | null }).created_by}
        createdAt={company.created_at}
        updatedBy={(company as { updated_by?: string | null }).updated_by}
        updatedAt={(company as { updated_at?: string | null }).updated_at}
      />
    </div>
  );
}

import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createCompanyType,
  renameCompanyType,
  setDefaultCompanyType,
  deleteCompanyType,
} from "@/modules/companies/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { AutoSaveInput } from "@/components/auto-save-input";
import { TableToolbar } from "@/components/data-table";

type CompanyType = { id: string; name: string; is_default: boolean };

// The company types offered in this country. One is the default, which the
// company form preselects.
export default async function CompanyTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("companies", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("company_types")
    .select("id, name, is_default")
    .eq("country_id", active.id)
    .order("sort")
    .order("name");
  const rows = (data ?? []) as CompanyType[];
  const canEdit = Boolean(can(cu, "companies", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/companies" className="text-xs text-muted hover:text-foreground">← Companies</Link>
        <h1 className="mt-1 text-xl font-semibold">Company Types</h1>
        <p className="mt-1 text-sm text-muted">
          The legal forms a company can be registered as in {active.name}. The default one is preselected on new
          company forms.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={createCompanyType} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="country_id" value={active.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">New Company Type</label>
            <input name="name" className="input" placeholder="e.g. Limited Company" required />
          </div>
          <ActionButton icon="plus" tip="Add this company type" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="type" />

      <div className="card divide-y divide-border">
        {rows.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">No company types in {active.name} yet.</p>
        )}
        {rows.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            {canEdit ? (
              <AutoSaveInput
                action={renameCompanyType}
                name="name"
                value={t.name}
                hidden={{ id: t.id }}
                className="input min-w-48 flex-1 py-1.5 text-sm"
              />
            ) : (
              <span className="min-w-48 flex-1 text-sm">{t.name}</span>
            )}
            {t.is_default ? (
              <span className="rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-[11px] text-accent-strong">
                Default
              </span>
            ) : (
              canEdit && (
                <form action={setDefaultCompanyType}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="country_id" value={active.id} />
                  <ActionButton icon="check" tip={`Make ${t.name} the default`} label="Set Default" />
                </form>
              )
            )}
            {can(cu, "companies", "delete") && (
              <form action={deleteCompanyType}>
                <input type="hidden" name="id" value={t.id} />
                <ActionButton icon="trash" tip={`Delete ${t.name}`} variant="danger" />
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

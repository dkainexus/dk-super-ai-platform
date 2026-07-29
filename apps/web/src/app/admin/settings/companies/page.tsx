import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { companiesSettings } from "@/modules/companies/lib";
import { toggleShareholders } from "@/modules/companies/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ToggleButton } from "@/components/toggle-button";

// Companies module settings for the country you are working in. Shareholders
// are a per-country rule: some registries record them with share percentages,
// most do not.
export default async function CompaniesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const settings = await companiesSettings();
  const on = settings.shareholder_countries.includes(active.id);
  const canEdit = Boolean(can(cu, "settings", "edit"));
  const back = "/admin/settings/companies";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/modules" className="text-xs text-muted hover:text-foreground">← Modules</Link>
        <h1 className="mt-1 text-xl font-semibold">Shareholder Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Whether company registrations in {active.name} record shareholders. Switch country in the sidebar to set another one.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-medium">Shareholders</p>
          <p className="mt-1 text-xs text-muted">
            When on, company forms in {active.name} gain a Shareholders section with share percentages.
          </p>
        </div>
        <form action={toggleShareholders}>
          <input type="hidden" name="country_id" value={active.id} />
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <input type="hidden" name="back" value={back} />
          <ToggleButton on={on} name={`shareholders in ${active.name}`} readOnly={!canEdit} />
        </form>
      </section>
    </div>
  );
}

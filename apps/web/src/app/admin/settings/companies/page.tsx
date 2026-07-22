import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { companiesSettings } from "@/modules/companies/lib";
import { saveCompaniesSettings } from "@/modules/companies/actions";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import type { Country } from "@/lib/types";

// Companies module settings: which countries require shareholders on
// company registrations.
export default async function CompaniesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error, saved } = await searchParams;
  const canEdit = can(cu, "settings", "edit");

  const [{ data: countries }, settings] = await Promise.all([
    db().from("countries").select("*").order("sort").order("name"),
    companiesSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/modules" className="text-xs text-muted hover:text-foreground">
          ← Modules
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Companies Module Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Shareholders per country: in some countries a company registration includes shareholders with share
          percentages. Switch it on for the countries that need it — company forms there gain a Shareholders section.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Settings saved.
        </p>
      )}

      <form action={saveCompaniesSettings} className="space-y-3">
        {((countries ?? []) as Country[]).map((c) => (
          <label
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-accent"
          >
            <span>
              <span className="block text-sm font-medium">
                {c.flag || "🌐"} {c.name}
              </span>
              <span className="block text-xs text-muted">Enable shareholders on company forms in {c.name}</span>
            </span>
            <input
              type="checkbox"
              name={`sh_${c.id}`}
              defaultChecked={settings.shareholder_countries.includes(c.id)}
              disabled={!canEdit}
              className="h-4 w-4"
            />
          </label>
        ))}
        {(countries ?? []).length === 0 && <p className="card px-5 py-6 text-sm text-muted">No countries yet.</p>}
        {canEdit && <SaveButton tip="Save shareholder settings" />}
      </form>
    </div>
  );
}

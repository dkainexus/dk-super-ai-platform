import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { toggleCountryModule } from "@/modules/countries/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { TOGGLABLE_MODULES } from "@/modules/registry";
import { ToggleButton } from "@/components/toggle-button";
import { ErrorBanner } from "@/components/error-banner";

// Which modules run in the country you are working in.
export default async function CountryModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("countries", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db().from("countries").select("disabled_modules").eq("id", active.id).maybeSingle();
  const disabled = ((data?.disabled_modules ?? []) as string[]) ?? [];
  const canEdit = Boolean(can(cu, "countries", "edit"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Modules in {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Switch a module off and it disappears from this country for everyone — the white label portal included.
          Modules switched off platform-wide stay off regardless.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-2 sm:grid-cols-2">
        {TOGGLABLE_MODULES.map((mod) => {
          const on = !disabled.includes(mod.key);
          return (
            <form
              key={mod.key}
              action={toggleCountryModule}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
            >
              <input type="hidden" name="country_id" value={active.id} />
              <input type="hidden" name="key" value={mod.key} />
              <input type="hidden" name="on" value={on ? "0" : "1"} />
              <input type="hidden" name="back" value="/admin/country/modules" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{mod.name}</p>
                <p className="truncate text-xs text-muted">{mod.description}</p>
              </div>
              {canEdit ? (
                <ToggleButton on={on} name={`${mod.name} in ${active.name}`} />
              ) : (
                <ToggleButton on={on} name={mod.name} readOnly />
              )}
            </form>
          );
        })}
      </div>
    </div>
  );
}

import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createCountryField,
  updateCountryField,
  deleteCountryField,
} from "@/modules/owners/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, CountryField } from "@/lib/types";

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  multiselect: "Multiple select",
  file: "Upload",
};

// Owners module settings: the extra fields collected per country.
// Text, number, date, dropdown, multiple select or upload.
export default async function OwnersModuleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; country?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error, country: countryParam } = await searchParams;
  const canEdit = can(cu, "settings", "edit");

  const [{ data: countries }] = await Promise.all([
    db().from("countries").select("*").order("sort").order("name"),
  ]);
  const countryList = (countries ?? []) as Country[];
  const selected = countryList.find((c) => c.id === countryParam) ?? countryList[0] ?? null;

  const { data: fields } = selected
    ? await db().from("country_fields").select("*").eq("country_id", selected.id).order("sort")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="text-xs text-muted hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Owners Module Settings</h1>
        <p className="mt-1 text-sm text-muted">Custom form fields per country and the global occupations list.</p>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Custom fields (per country) ---------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Owner Custom Fields</h2>
        <p className="text-xs text-muted">
          Built-in fields: name, ID number, ID photos, full-body photo, bank, occupation, contact. Fields added here
          appear on every owner form of the selected country — e.g. Tabien Baan for Thailand.
        </p>

        {countryList.length === 0 ? (
          <p className="card px-5 py-6 text-sm text-muted">Create a country first (Countries page).</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {countryList.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/settings/owners?country=${c.id}`}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected?.id === c.id
                      ? "border-accent bg-accent-soft text-accent-strong"
                      : "border-border text-muted hover:border-accent hover:text-foreground"
                  }`}
                >
                  {c.flag || "🌐"} {c.name}
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              {((fields ?? []) as CountryField[]).length === 0 && (
                <p className="card px-5 py-6 text-sm text-muted">
                  No custom fields for {selected?.name} yet.
                </p>
              )}
              {((fields ?? []) as CountryField[]).map((f) =>
                canEdit ? (
                  <div key={f.id} className="card p-4">
                    <form
                      action={updateCountryField}
                      className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_5rem_5rem_auto_auto]"
                    >
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="country_id" value={selected!.id} />
                      <div>
                        <label className="mb-1 block text-xs text-muted">
                          Label{" "}
                          <span className="mono-num">
                            ({f.field_key} · {FIELD_TYPE_LABEL[f.field_type]})
                          </span>
                        </label>
                        <input name="label" defaultValue={f.label} className="input" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted">Sort</label>
                        <input name="sort" type="number" defaultValue={f.sort} className="input mono-num" />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                        <input type="checkbox" name="required" defaultChecked={f.required} /> Required
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                        <input type="checkbox" name="active" defaultChecked={f.active} /> Enabled
                      </label>
                      <SaveButton tip="Save this field" />
                      <button
                        type="submit"
                        formAction={deleteCountryField}
                        title="Delete this field (fields already holding data are deactivated instead)"
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    </form>
                    {f.field_type === "select" && (
                      <p className="mt-2 text-xs text-muted">Options: {(f.options ?? []).join(" / ")}</p>
                    )}
                  </div>
                ) : (
                  <div key={f.id} className="card flex items-center justify-between p-4">
                    <p className="text-sm font-medium">
                      {f.label}{" "}
                      <span className="mono-num text-xs text-muted">
                        ({f.field_key} · {FIELD_TYPE_LABEL[f.field_type]}
                        {f.required ? " · required" : ""})
                      </span>
                    </p>
                    <ActiveTag active={f.active} />
                  </div>
                )
              )}
            </div>

            {canEdit && selected && (
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-semibold">
                  Add Field to {selected.flag || "🌐"} {selected.name}
                </h3>
                <form action={createCountryField} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="country_id" value={selected.id} />
                  <div>
                    <label className="mb-1 block text-xs text-muted">Field Label (shown on the form)</label>
                    <input name="label" placeholder="Tabien Baan" className="input" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Field key (optional, auto-generated)</label>
                    <input name="field_key" placeholder="tabien_baan" className="input mono-num" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Type</label>
                    <select name="field_type" className="input">
                      {Object.entries(FIELD_TYPE_LABEL).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Options (select type only, comma separated)</label>
                    <input name="options" placeholder="Option A, Option B" className="input" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" name="required" /> Required field
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton label="Add Field" />
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </section>

    </div>
  );
}

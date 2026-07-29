import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  updateOccupation,
  createCountryField,
  updateCountryField,
  deleteCountryField,
} from "@/modules/owners/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, CountryField, Occupation } from "@/lib/types";
import { OCCUPATION_GROUPS } from "@/modules/owners/occupations";

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  file: "File Upload",
  select: "Select",
};

// Owners module settings: per-country custom fields + the global
// Occupations list (Company Type = which kind of company to register).
export default async function OwnersModuleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; country?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error, country: countryParam } = await searchParams;
  const canEdit = can(cu, "settings", "edit");

  const [{ data: countries }, { data: occupations }] = await Promise.all([
    db().from("countries").select("*").order("sort").order("name"),
    db().from("occupations").select("*").order("sort"),
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
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="file">File Upload</option>
                      <option value="select">Select</option>
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

      {/* ---------- Occupations (built-in catalogue) ---------- */}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Occupations</h2>
        <p className="text-xs text-muted">
          A built-in catalogue covering every industry — nothing to add or remove. Set <b>Company Type</b> to say which
          kind of company that occupation registers.
        </p>

        {OCCUPATION_GROUPS.map((g) => {
          const rows = ((occupations ?? []) as Occupation[]).filter((o) => g.names.includes(o.name));
          if (rows.length === 0) return null;
          return (
            <div key={g.group} className="space-y-2">
              <p className="pt-2 text-xs font-semibold text-muted">{g.group}</p>
              <div className="card divide-y divide-border">
                {rows.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                    <p className="flex-1 text-sm">{o.name}</p>
                    {canEdit ? (
                      <form action={updateOccupation} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="name" value={o.name} />
                        <input type="hidden" name="active" value="on" />
                        <input
                          name="company_type"
                          defaultValue={o.company_type ?? ""}
                          placeholder="Company type…"
                          className="input w-56 py-1.5 text-xs"
                        />
                        <SaveButton tip={`Save the company type for ${o.name}`} />
                      </form>
                    ) : (
                      <span className="text-xs text-muted">{o.company_type ?? "—"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

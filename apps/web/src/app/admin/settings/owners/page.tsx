import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createCountryField,
  updateCountryField,
  deleteCountryField,
  toggleCountryField,
} from "@/modules/owners/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { TableToolbar } from "@/components/data-table";
import { ToggleButton } from "@/components/toggle-button";
import type { CountryField } from "@/lib/types";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multiple select" },
  { value: "file", label: "Upload" },
];

// Extra questions the owner form asks in this country, on top of the built-in
// name / ID / photos / bank / occupation / contact fields.
export default async function OwnerExtraFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("country_fields")
    .select("*")
    .eq("country_id", active.id)
    .order("sort")
    .order("created_at");
  const fields = (data ?? []) as CountryField[];
  const canEdit = Boolean(can(cu, "settings", "edit"));
  const back = "/admin/settings/owners";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Owner Extra Fields</h1>
        <p className="mt-1 text-sm text-muted">
          Extra questions the owner form asks in {active.name}. Already built in: name, ID number, ID photos,
          profile picture, bank, occupation and contact. Tick <b>Downloadable</b> on an upload field to include it in
          the owner&apos;s one-click document download.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form
          action={createCountryField}
          className="card grid gap-3 p-5 sm:grid-cols-[1fr_9rem_1fr_auto_auto] sm:items-end"
        >
          <input type="hidden" name="country_id" value={active.id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="mb-1 block text-xs text-muted">New Field</label>
            <input name="label" className="input" placeholder="e.g. LINE ID" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Type</label>
            <select name="field_type" className="input">
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Choices (comma separated)</label>
            <input name="options" className="input" placeholder="dropdown / multiple select only" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-muted">
            <input type="checkbox" name="required" /> Required
          </label>
          <ActionButton icon="plus" tip="Add this field" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={fields.length} noun="field" />

      <div className="card divide-y divide-border">
        {fields.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">No extra fields in {active.name} yet.</p>
        )}
        {fields.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {canEdit ? (
              <>
                <form action={updateCountryField} className="flex min-w-64 flex-1 flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="country_id" value={active.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="sort" value={f.sort} />
                  <input type="hidden" name="active" value={f.active ? "on" : ""} />
                  <input name="label" defaultValue={f.label} className="input min-w-40 flex-1 py-1.5 text-sm" />
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
                    {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                  </span>
                  <input
                    name="options"
                    defaultValue={(f.options ?? []).join(", ")}
                    placeholder="choices"
                    className="input min-w-32 flex-1 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="required" defaultChecked={f.required} /> Required
                  </label>
                  {f.field_type === "file" && (
                    <label
                      className="flex items-center gap-2 text-xs text-muted"
                      title="Include this upload in the owner's one-click document download"
                    >
                      <input
                        type="checkbox"
                        name="downloadable"
                        defaultChecked={(f as CountryField & { downloadable?: boolean }).downloadable}
                      />{" "}
                      Downloadable
                    </label>
                  )}
                  <SaveButton tip={`Save ${f.label}`} />
                </form>
                <form action={toggleCountryField}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="on" value={f.active ? "0" : "1"} />
                  <ToggleButton on={f.active} name={f.label} />
                </form>
                <form action={deleteCountryField}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="country_id" value={active.id} />
                  <input type="hidden" name="back" value={back} />
                  <ActionButton icon="trash" tip={`Delete ${f.label}`} variant="danger" />
                </form>
              </>
            ) : (
              <span className="text-sm">{f.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

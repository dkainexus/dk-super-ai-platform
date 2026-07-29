import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createCountryField, updateCountryField, deleteCountryField } from "@/modules/owners/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";
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
          full-body photo, bank, occupation and contact.
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

      <Table head={["Field", "Type", "Choices", "Required", "Active", ""]}>
        {fields.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted">No extra fields in {active.name} yet.</td>
          </tr>
        )}
        {fields.map((f) => (
          <tr key={f.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2">
              {canEdit ? (
                <>
                  <form action={updateCountryField} id={`f-${f.id}`}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="country_id" value={active.id} />
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="sort" value={f.sort} />
                  </form>
                  <input
                    form={`f-${f.id}`}
                    name="label"
                    defaultValue={f.label}
                    className="input w-full max-w-xs py-1.5 text-sm"
                  />
                </>
              ) : (
                f.label
              )}
            </td>
            <td className="px-4 py-2 text-muted">
              {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
            </td>
            <td className="px-4 py-2">
              {canEdit ? (
                <input
                  form={`f-${f.id}`}
                  name="options"
                  defaultValue={(f.options ?? []).join(", ")}
                  placeholder="—"
                  className="input w-full max-w-xs py-1.5 text-sm"
                />
              ) : (
                (f.options ?? []).join(", ") || "—"
              )}
            </td>
            <td className="px-4 py-2">
              {canEdit ? (
                <input form={`f-${f.id}`} type="checkbox" name="required" defaultChecked={f.required} />
              ) : (
                f.required ? "Yes" : "No"
              )}
            </td>
            <td className="px-4 py-2">
              {canEdit ? (
                <input form={`f-${f.id}`} type="checkbox" name="active" defaultChecked={f.active} />
              ) : (
                f.active ? "Yes" : "No"
              )}
            </td>
            <td className="px-4 py-2">
              {canEdit && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    form={`f-${f.id}`}
                    title={`Save ${f.label}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent"
                  >
                    Save
                  </button>
                  <form action={deleteCountryField}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="country_id" value={active.id} />
                    <input type="hidden" name="back" value={back} />
                    <ActionButton icon="trash" tip={`Delete ${f.label}`} variant="danger" />
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

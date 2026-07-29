import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { addProvince, updateProvince, deleteProvince } from "@/modules/countries/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { TableToolbar } from "@/components/data-table";

type Province = { id: string; name: string; active: boolean };

// The state / province list this country's address fields offer.
export default async function ProvincesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("countries", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("provinces")
    .select("id, name, active")
    .eq("country_id", active.id)
    .order("sort")
    .order("name");
  const rows = (data ?? []) as Province[];
  const canEdit = Boolean(can(cu, "countries", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">States / Provinces</h1>
        <p className="mt-1 text-sm text-muted">
          What the address dropdowns offer in {active.name}. Seeded when the country was added — edit freely.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={addProvince} className="card flex max-w-md items-end gap-3 p-5">
          <input type="hidden" name="country_id" value={active.id} />
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Add</label>
            <input name="name" className="input" placeholder="e.g. Bangkok" required />
          </div>
          <ActionButton icon="plus" tip="Add this state / province" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="state / province" />

      <div className="card divide-y divide-border">
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nothing here yet.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
            {canEdit ? (
              <>
                <form action={updateProvince} className="flex min-w-64 flex-1 items-center gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="name" defaultValue={p.name} className="input flex-1 py-1.5 text-sm" />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="active" defaultChecked={p.active} /> Active
                  </label>
                  <SaveButton tip={`Save ${p.name}`} />
                </form>
                <form action={deleteProvince}>
                  <input type="hidden" name="id" value={p.id} />
                  <ActionButton icon="trash" tip={`Delete ${p.name}`} variant="danger" />
                </form>
              </>
            ) : (
              <span className="text-sm">{p.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

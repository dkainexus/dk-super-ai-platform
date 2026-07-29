import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import {
  addRegion,
  addRegionsBulk,
  updateRegion,
  deleteRegion,
  saveAddressLevels,
} from "@/modules/countries/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { addressLevels, regionsAt, regionPath, childCounts } from "@/modules/countries/regions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { AutoSaveInput } from "@/components/auto-save-input";
import { TableToolbar } from "@/components/data-table";

// The country's administrative areas, one level at a time. Thailand runs
// Province → District → Sub-district; Singapore stops at one level. Drill in by
// clicking an area.
export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; parent?: string }>;
}) {
  const { cu } = await requirePerm("countries", "view");
  const { error, parent = "" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const levels = addressLevels(active as { address_levels?: string[] | null });
  const path = await regionPath(parent || null);
  const level = path.length + 1;
  const levelName = levels[level - 1] ?? `Level ${level}`;
  const canGoDeeper = level < levels.length;

  const [rows, counts] = await Promise.all([
    regionsAt(active.id, parent || null),
    childCounts(active.id),
  ]);
  const canEdit = Boolean(can(cu, "countries", "edit"));
  const here = `/admin/country/regions${parent ? `?parent=${parent}` : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/country" className="text-xs text-muted hover:text-foreground">← Countries</Link>
        <h1 className="mt-1 text-xl font-semibold">Areas — {levelName}</h1>
        <p className="mt-1 text-sm text-muted">
          What the address dropdowns offer in {active.name}: {levels.join(" → ")}.
        </p>
      </div>
      <ErrorBanner message={error} />

      {/* Breadcrumb through the tree */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link
          href="/admin/country/regions"
          className={parent ? "text-accent-strong hover:underline" : "font-medium"}
        >
          {levels[0]}
        </Link>
        {path.map((r, i) => (
          <span key={r.id} className="flex items-center gap-1.5">
            <span className="text-muted">›</span>
            <Link
              href={`/admin/country/regions?parent=${r.id}`}
              className={i === path.length - 1 ? "font-medium" : "text-accent-strong hover:underline"}
            >
              {r.name}
            </Link>
          </span>
        ))}
      </div>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={addRegion} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="country_id" value={active.id} />
            <input type="hidden" name="parent_id" value={parent} />
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="back" value={here} />
            <div>
              <label className="mb-1 block text-xs text-muted">New {levelName}</label>
              <input name="name" className="input" required />
            </div>
            <ActionButton icon="plus" tip={`Add this ${levelName.toLowerCase()}`} label="Add" variant="primary" />
          </form>

          <form action={addRegionsBulk} className="card grid gap-3 p-5">
            <input type="hidden" name="country_id" value={active.id} />
            <input type="hidden" name="parent_id" value={parent} />
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="back" value={here} />
            <div>
              <label className="mb-1 block text-xs text-muted">Paste a whole list — one per line</label>
              <textarea name="names" rows={3} className="input" placeholder={`Every ${levelName.toLowerCase()} here`} />
            </div>
            <div>
              <ActionButton icon="upload" tip="Add every name in the box" label="Add All" />
            </div>
          </form>
        </div>
      )}

      <TableToolbar count={rows.length} noun={levelName.toLowerCase()} />

      <div className="card divide-y divide-border">
        {rows.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">
            No {levelName.toLowerCase()} here yet{canEdit ? " — add them above." : "."}
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            {canEdit ? (
              <AutoSaveInput
                action={updateRegion}
                name="name"
                value={r.name}
                hidden={{ id: r.id, back: here }}
                className="input min-w-48 flex-1 py-1.5 text-sm"
              />
            ) : (
              <span className="min-w-48 flex-1 text-sm">{r.name}</span>
            )}
            {canGoDeeper && (
              <Link
                href={`/admin/country/regions?parent=${r.id}`}
                title={`Open the ${levels[level]?.toLowerCase() ?? "areas"} inside ${r.name}`}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                {counts.get(r.id) ?? 0} {levels[level]?.toLowerCase() ?? "areas"} →
              </Link>
            )}
            {canEdit && (
              <form action={deleteRegion}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={here} />
                <ActionButton icon="trash" tip={`Delete ${r.name}`} variant="danger" />
              </form>
            )}
          </div>
        ))}
      </div>

      {canEdit && !parent && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Address Levels</h2>
          <p className="mb-4 text-xs text-muted">
            What the levels are called in {active.name}, from widest to narrowest. Leave a box empty to stop there —
            Singapore uses one level, Australia and Vietnam two, Thailand and Malaysia three.
          </p>
          <form action={saveAddressLevels} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="country_id" value={active.id} />
            <input type="hidden" name="back" value={here} />
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <label className="mb-1 block text-xs text-muted">Level {n}</label>
                <input
                  name={`level_${n}`}
                  defaultValue={levels[n - 1] ?? ""}
                  placeholder={n === 1 ? "e.g. Province" : "leave empty to stop"}
                  className="input"
                />
              </div>
            ))}
            <SaveButton tip="Save the address levels" />
          </form>
        </section>
      )}
    </div>
  );
}

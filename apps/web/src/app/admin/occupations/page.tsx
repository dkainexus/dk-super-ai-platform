import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createOccupation, updateOccupation, deleteOccupation } from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { Country, Occupation } from "@/lib/types";

// Occupations module: per-country occupation list. Each occupation can map to
// a company type — used to decide what kind of company to register for an owner.
export default async function OccupationsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; error?: string }>;
}) {
  const { cu } = await requirePerm("occupations", "view");
  const { country = "", error } = await searchParams;

  const { data: countries } = await db().from("countries").select("*").eq("active", true).order("sort");
  const list = (countries ?? []) as Country[];
  const selected = list.find((c) => c.id === country) ?? list[0] ?? null;

  const { data: occupations } = selected
    ? await db().from("occupations").select("*").eq("country_id", selected.id).order("sort").order("name")
    : { data: [] };

  const canEdit = can(cu, "occupations", "edit");
  const canAdd = can(cu, "occupations", "add");
  const canDelete = can(cu, "occupations", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Occupations</h1>
        <p className="mt-1 text-sm text-muted">
          Occupation list per country. <b>Company Type</b> is what that occupation maps to when deciding which kind of
          company to register.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-center gap-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/admin/occupations?country=${c.id}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selected?.id === c.id
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {c.flag} {c.name}
          </Link>
        ))}
      </div>

      {selected && (
        <>
          <div className="space-y-3">
            {((occupations ?? []) as Occupation[]).length === 0 && (
              <p className="card px-5 py-6 text-sm text-muted">No occupations for {selected.name} yet.</p>
            )}
            {((occupations ?? []) as Occupation[]).map((o) => (
              <div key={o.id} className="card p-4">
                {canEdit ? (
                  <form action={updateOccupation} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_6rem_5rem_auto_auto]">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="country_id" value={selected.id} />
                    <div>
                      <label className="mb-1 block text-xs text-muted">Occupation</label>
                      <input name="name" defaultValue={o.name} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Company Type (maps to)</label>
                      <input name="company_type" defaultValue={o.company_type ?? ""} placeholder="e.g. Limited Company" className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Sort</label>
                      <input name="sort" type="number" defaultValue={o.sort} className="input mono-num" />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                      <input type="checkbox" name="active" defaultChecked={o.active} /> Active
                    </label>
                    <SaveButton tip="Save this occupation" />
                    {canDelete && (
                      <button
                        type="submit"
                        formAction={deleteOccupation}
                        title="Delete this occupation"
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {o.name}
                      {o.company_type && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">→ {o.company_type}</span>}
                    </p>
                    <ActiveTag active={o.active} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {canAdd && (
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">
                Add Occupation — {selected.flag} {selected.name}
              </h2>
              <form action={createOccupation} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="country_id" value={selected.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Occupation Name</label>
                  <input name="name" className="input" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Company Type (optional)</label>
                  <input name="company_type" placeholder="e.g. Limited Company" className="input" />
                </div>
                <ActionButton icon="plus" tip="Add this occupation" label="Add" variant="primary" />
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}

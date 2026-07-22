import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createOccupation, updateOccupation, deleteOccupation } from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { Occupation } from "@/lib/types";

// Owners module settings. Currently holds the global Occupations list
// (Company Type = which kind of company to register for that occupation);
// future owner-module settings live here too.
export default async function OwnersModuleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;
  const canEdit = can(cu, "settings", "edit");

  const { data: occupations } = await db().from("occupations").select("*").order("sort").order("name");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="text-xs text-muted hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Owners Module Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configuration for the Owners module.
        </p>
      </div>
      <ErrorBanner message={error} />

      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Occupations</h2>
      <p className="-mt-4 text-xs text-muted">
        One global list used by all countries. <b>Company Type</b> is what that occupation maps to when deciding which
        kind of company to register.
      </p>

      <div className="space-y-3">
        {((occupations ?? []) as Occupation[]).map((o) => (
          <div key={o.id} className="card p-4">
            {canEdit ? (
              <form action={updateOccupation} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_6rem_5rem_auto_auto]">
                <input type="hidden" name="id" value={o.id} />
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
                <button
                  type="submit"
                  formAction={deleteOccupation}
                  title="Delete this occupation"
                  className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Delete
                </button>
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

      {canEdit && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Add Occupation</h2>
          <form action={createOccupation} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
    </div>
  );
}

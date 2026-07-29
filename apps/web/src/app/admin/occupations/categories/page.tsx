import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createOccupationCategory,
  updateOccupationCategory,
  deleteOccupationCategory,
} from "@/modules/owners/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";

type Category = { id: string; name: string; occupations: { count: number }[] };

// The groups occupations are sorted into (Healthcare, Transport, …).
export default async function OccupationCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;

  const { data } = await db()
    .from("occupation_categories")
    .select("id, name, occupations(count)")
    .order("sort")
    .order("name");
  const rows = (data ?? []) as unknown as Category[];
  const canEdit = Boolean(can(cu, "settings", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/occupations" className="text-xs text-muted hover:text-foreground">← Occupations</Link>
        <h1 className="mt-1 text-xl font-semibold">Occupation Categories</h1>
        <p className="mt-1 text-sm text-muted">Groups you can sort occupations into.</p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={createOccupationCategory} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">New Category</label>
            <input name="name" className="input" placeholder="e.g. Transport & Logistics" required />
          </div>
          <ActionButton icon="plus" tip="Add this category" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="category" />

      <Table head={["Category", "Occupations", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="px-4 py-6 text-sm text-muted">No categories yet.</td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2">
              {canEdit ? (
                <form action={updateOccupationCategory} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" defaultValue={c.name} className="input w-full max-w-xs py-1.5 text-sm" />
                  <SaveButton tip="Rename this category" />
                </form>
              ) : (
                c.name
              )}
            </td>
            <td className="mono-num px-4 py-2 text-muted">{c.occupations?.[0]?.count ?? 0}</td>
            <td className="px-4 py-2 text-right">
              {canEdit && (
                <form action={deleteOccupationCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <ActionButton icon="trash" tip={`Delete ${c.name}`} variant="danger" />
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

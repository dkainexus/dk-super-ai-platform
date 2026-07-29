import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createOccupation, deleteOccupation, setOccupation } from "@/modules/owners/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { AutoSaveSelect } from "@/components/auto-save-select";
import { TableToolbar } from "@/components/data-table";

type Occupation = { id: string; name: string; category_id: string | null; sort: number };
type Category = { id: string; name: string };

// The occupation list owners pick from. Each one belongs to a category managed
// under Occupation Categories; changing the category saves immediately.
export default async function OccupationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;

  const [{ data: occupations }, { data: categories }] = await Promise.all([
    db().from("occupations").select("id, name, category_id, sort").order("sort").order("name"),
    db().from("occupation_categories").select("id, name").order("sort").order("name"),
  ]);
  const rows = (occupations ?? []) as Occupation[];
  const cats = (categories ?? []) as Category[];
  const canEdit = Boolean(can(cu, "settings", "edit"));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Occupations</h1>
          <p className="mt-1 text-sm text-muted">What an owner does for a living — pick a category for each.</p>
        </div>
        <Link
          href="/admin/occupations/categories"
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
        >
          Categories →
        </Link>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={createOccupation} className="card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">New Occupation</label>
            <input name="name" className="input" placeholder="e.g. Delivery Rider" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Category</label>
            <select name="category_id" className="input" defaultValue="">
              <option value="">— none —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <ActionButton icon="plus" tip="Add this occupation" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={rows.length} noun="occupation" />

      {[...cats, { id: "", name: "Uncategorised" }].map((cat) => {
        const mine = rows.filter((o) => (o.category_id ?? "") === cat.id);
        if (mine.length === 0) return null;
        return (
          <section key={cat.id || "none"} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{cat.name}</h2>
            <div className="card divide-y divide-border">
              {mine.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  {canEdit ? (
                    <>
                      <form action={setOccupation} className="min-w-48 flex-1">
                        <input type="hidden" name="id" value={o.id} />
                        <input
                          name="name"
                          defaultValue={o.name}
                          className="input w-full py-1.5 text-sm"
                          title="Press Enter to rename"
                        />
                      </form>
                      <AutoSaveSelect
                        action={setOccupation}
                        name="category_id"
                        value={o.category_id ?? ""}
                        hidden={{ id: o.id }}
                        options={[
                          { value: "", label: "— none —" },
                          ...cats.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                      <form action={deleteOccupation}>
                        <input type="hidden" name="id" value={o.id} />
                        <ActionButton icon="trash" tip={`Delete ${o.name}`} variant="danger" />
                      </form>
                    </>
                  ) : (
                    <span className="text-sm">{o.name}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

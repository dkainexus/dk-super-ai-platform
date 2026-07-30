import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import {
  saveExpenseCategory,
  toggleExpenseCategory,
  saveExpenseItem,
  toggleExpenseItem,
} from "@/modules/expenses/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";

// The kinds of spending we record, per country. Add whatever the business
// needs — switching one off hides it from the expense form without touching
// anything already recorded under it.
export default async function ExpenseCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("expenses", "view");
  const { error, saved } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("expense_categories")
    .select("id, name, active, items:expense_items(id, name, active)")
    .eq("country_id", active.id)
    .order("name");
  const categories = (data ?? []) as {
    id: string;
    name: string;
    active: boolean;
    items: { id: string; name: string; active: boolean }[];
  }[];
  const canEdit = Boolean(can(cu, "expenses", "edit"));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/expenses" className="text-xs text-muted hover:text-foreground">← Expenses</Link>
        <h1 className="mt-1 text-xl font-semibold">Expense Categories — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          The expense form picks from this list, and each category can carry preset items the form suggests —
          free typing stays allowed. Renaming or switching off only affects future entries.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      <section className="card divide-y divide-border p-5">
        {categories.length === 0 && <p className="pb-4 text-sm text-muted">No categories yet — add the first below.</p>}
        {categories.map((c) => (
          <div key={c.id} className="space-y-2 py-3">
            <div className="flex items-end gap-2">
              {canEdit ? (
                <form action={saveExpenseCategory} className="flex min-w-0 flex-1 items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
                    <input name="name" defaultValue={c.name} className="input py-1.5 text-sm" required />
                  </div>
                  <ActionButton icon="save" tip="Save this category" label="Save" variant="outline" />
                </form>
              ) : (
                <p className="flex-1 text-sm font-medium">{c.name}</p>
              )}
              <div className="flex items-center gap-2 pb-1">
                <ActiveTag active={c.active} on="Active" off="Off" />
                {canEdit && (
                  <form action={toggleExpenseCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                    <ActionButton
                      icon="power"
                      tip={c.active ? "Hide from the expense form" : "Show in the expense form"}
                      variant="outline"
                    />
                  </form>
                )}
              </div>
            </div>

            <details className="pl-1">
              <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                Preset items ({c.items.filter((i) => i.active).length})
              </summary>
              <div className="mt-2 space-y-2 border-l border-border pl-3">
                <div className="flex flex-wrap gap-1.5">
                  {c.items.length === 0 && <p className="text-xs text-muted">None yet.</p>}
                  {[...c.items]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((i) => (
                      <span
                        key={i.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                          i.active ? "border-border" : "border-border text-muted line-through"
                        }`}
                      >
                        {i.name}
                        {canEdit && (
                          <form action={toggleExpenseItem} className="inline-flex">
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="active" value={i.active ? "false" : "true"} />
                            <button
                              className="text-muted hover:text-foreground"
                              title={i.active ? "Stop suggesting this item" : "Suggest this item again"}
                            >
                              {i.active ? "×" : "↺"}
                            </button>
                          </form>
                        )}
                      </span>
                    ))}
                </div>
                {canEdit && (
                  <form action={saveExpenseItem} className="flex items-end gap-2">
                    <input type="hidden" name="category_id" value={c.id} />
                    <input name="name" className="input w-56 py-1 text-xs" placeholder="e.g. iPhone 15" required />
                    <ActionButton icon="plus" tip="Add this preset item" variant="outline" />
                  </form>
                )}
              </div>
            </details>
          </div>
        ))}

        {canEdit && (
          <form action={saveExpenseCategory} className="flex items-end gap-2 pt-4">
            <input type="hidden" name="country_id" value={active.id} />
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
              <input name="name" className="input py-1.5 text-sm" placeholder="e.g. Office rent" required />
            </div>
            <ActionButton icon="plus" tip="Add this category" label="Add" variant="primary" />
          </form>
        )}
      </section>
    </div>
  );
}

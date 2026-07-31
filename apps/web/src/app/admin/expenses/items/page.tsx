import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { saveExpenseItem, toggleExpenseItem } from "@/modules/expenses/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";

// The library of things we buy, each under a category. The expense form
// suggests these; anything typed fresh on the form joins the library by
// itself, and strays retire here.
export default async function ExpenseItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; category?: string }>;
}) {
  const { cu } = await requirePerm("expenses", "view");
  const { error, saved, category = "" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data: cats } = await db()
    .from("expense_categories")
    .select("id, name, active")
    .eq("country_id", active.id)
    .order("name");
  const categories = (cats ?? []) as { id: string; name: string; active: boolean }[];
  const catIds = categories.map((c) => c.id);

  let q = db()
    .from("expense_items")
    .select("id, name, active, category_id, category:expense_categories(name)")
    .in("category_id", catIds.length ? catIds : ["00000000-0000-0000-0000-000000000000"])
    .order("name");
  if (category) q = q.eq("category_id", category);
  const { data } = await q;
  const items = (data ?? []) as unknown as {
    id: string;
    name: string;
    active: boolean;
    category_id: string;
    category: { name: string } | null;
  }[];
  const canEdit = Boolean(can(cu, "expenses", "edit"));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/expenses" className="text-xs text-muted hover:text-foreground">← Expenses</Link>
        <h1 className="mt-1 text-xl font-semibold">Expense Items — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Everything we buy, each under its category. The expense form suggests these — and whatever is typed
          fresh on the form joins this list by itself. Switching one off only hides the suggestion.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      {canEdit && (
        <form action={saveExpenseItem} className="card flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-muted">Category</label>
            <select name="category_id" className="input w-auto" required>
              {categories.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-muted">Item name</label>
            <input name="name" className="input" placeholder="e.g. iPhone 15" required />
          </div>
          <ActionButton icon="plus" tip="Add this item to the library" label="Add" variant="primary" />
        </form>
      )}

      <TableToolbar count={items.length} noun="item">
        <FilterForm action="/admin/expenses/items">
          <FilterSelect
            label="Category"
            name="category"
            value={category}
            options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["Item", "Category", "Status", ""]}>
        {items.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-6 text-sm text-muted">No items yet — add the first above.</td>
          </tr>
        )}
        {items.map((i) => (
          <tr key={i.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5">
              {canEdit ? (
                <form action={saveExpenseItem} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="category_id" value={i.category_id} />
                  <input name="name" defaultValue={i.name} className="input w-56 py-1 text-sm" required />
                  <ActionButton icon="save" tip="Rename this item" variant="outline" />
                </form>
              ) : (
                i.name
              )}
            </td>
            <td className="px-4 py-2.5 text-muted">{i.category?.name ?? "—"}</td>
            <td className="px-4 py-2.5">
              <ActiveTag active={i.active} on="Active" off="Off" />
            </td>
            <td className="px-4 py-2.5 text-right">
              {canEdit && (
                <form action={toggleExpenseItem} className="inline-flex">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="active" value={i.active ? "false" : "true"} />
                  <ActionButton
                    icon="power"
                    tip={i.active ? "Stop suggesting this item" : "Suggest this item again"}
                    variant="outline"
                  />
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

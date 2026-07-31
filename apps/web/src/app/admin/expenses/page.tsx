import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createExpense, reviewExpenseClaim, deleteExpense } from "@/modules/expenses/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table, TableToolbar } from "@/components/data-table";
import { CategoryItemFields } from "@/modules/expenses/components/category-item-fields";
import { fmtNum } from "@/lib/format";

type Row = {
  id: string;
  category: string;
  item: string | null;
  amount: number;
  currency: string;
  spent_on: string;
  note: string | null;
  receipt_path: string | null;
  is_claim: boolean;
  claim_status: string | null;
  staff: { name: string | null; username: string } | null;
};

// One ledger for what the platform really spends. It is all our own money —
// nothing here belongs to a white label, so nothing is tagged to one.
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("expenses", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  const [{ data: rows }, { data: categories }] = await Promise.all([
    db()
      .from("expenses")
      .select("*, staff:users!expenses_staff_user_id_fkey(name, username)")
      .eq("country_id", active?.id ?? "")
      .order("spent_on", { ascending: false })
      .limit(200),
    db()
      .from("expense_categories")
      .select("id, name, items:expense_items(category_id, name, active)")
      .eq("country_id", active?.id ?? "")
      .eq("active", true)
      .order("name"),
  ]);
  const catList = (categories ?? []) as unknown as {
    id: string;
    name: string;
    items: { category_id: string; name: string; active: boolean }[];
  }[];
  const presetItems = catList.flatMap((c) => c.items.filter((i) => i.active));
  const list = (rows ?? []) as unknown as Row[];
  const canEdit = Boolean(can(cu, "expenses", "edit"));
  const receipts = new Map<string, string | null>();
  for (const r of list) {
    if (r.receipt_path) receipts.set(r.id, await signedUrl(DOCS_BUCKET, r.receipt_path, 1800));
  }
  const total = list
    .filter((r) => !r.is_claim || r.claim_status === "approved")
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Expenses</h1>
        <p className="mt-1 text-sm text-muted">
          {active ? `${active.name} only. ` : ""}A staff claim counts as cost only once approved.
        </p>
      </div>
      <ErrorBanner message={error} />

      {can(cu, "expenses", "add") && (
        <form action={createExpense} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <CategoryItemFields
            categories={catList.map((c) => ({ id: c.id, name: c.name }))}
            items={presetItems}
          />
          <div>
            <label className="mb-1 block text-xs text-muted">Amount</label>
            <MoneyInput name="amount" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Date</label>
            <input name="spent_on" type="date" className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Note</label>
            <input name="note" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Receipt</label>
            <input name="receipt" type="file" accept="image/*,.pdf" className="input" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 pb-2 text-xs text-muted" title="You paid this yourself and want it back">
              <input type="checkbox" name="is_claim" /> My claim
            </label>
            <ActionButton icon="plus" tip="Record this expense" label="Add" variant="primary" />
          </div>
        </form>
      )}

      <TableToolbar count={list.length} noun="expense">
        <p className="mono-num text-sm">
          Real cost: <b>{fmtNum(total)} {active?.currency ?? ""}</b>
        </p>
      </TableToolbar>

      <Table head={["Date", "Category", "Item", "Staff", "Note", "Amount", "Claim", ""]}>
        {list.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">Nothing recorded yet.</td>
          </tr>
        )}
        {list.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-muted">{r.spent_on}</td>
            <td className="px-4 py-2.5">{r.category}</td>
            <td className="px-4 py-2.5">{r.item ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{r.staff ? r.staff.name || r.staff.username : "—"}</td>
            <td className="px-4 py-2.5 text-muted">
              {r.note ?? "—"}
              {receipts.get(r.id) && (
                <a href={receipts.get(r.id)!} target="_blank" rel="noreferrer" className="ml-2 text-xs text-accent-strong underline">
                  receipt ↗
                </a>
              )}
            </td>
            <td className="mono-num px-4 py-2.5">{fmtNum(r.amount)}</td>
            <td className="px-4 py-2.5">
              {r.is_claim ? (
                r.claim_status === "pending" && canEdit ? (
                  <span className="flex gap-1.5">
                    <form action={reviewExpenseClaim}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <ActionButton icon="check" tip="Approve this claim — it becomes real cost" variant="success" />
                    </form>
                    <form action={reviewExpenseClaim}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <ActionButton icon="x" tip="Reject this claim" variant="danger" />
                    </form>
                  </span>
                ) : (
                  <span className="text-xs capitalize text-muted">{r.claim_status}</span>
                )
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-right">
              {can(cu, "expenses", "delete") && (
                <form action={deleteExpense}>
                  <input type="hidden" name="id" value={r.id} />
                  <ActionButton icon="trash" tip="Delete this record" variant="danger" />
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

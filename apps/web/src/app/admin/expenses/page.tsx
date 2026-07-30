import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createExpense, reviewExpenseClaim, deleteExpense } from "@/modules/expenses/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table, TableToolbar } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

const CATEGORIES = ["Company registration", "Legal", "Device", "Travel", "Escort", "Other"];

type Row = {
  id: string;
  category: string;
  amount: number;
  currency: string;
  spent_on: string;
  note: string | null;
  receipt_path: string | null;
  is_claim: boolean;
  claim_status: string | null;
  company: { name: string } | null;
  staff: { name: string | null; username: string } | null;
};

// One ledger for what the platform really spends — company costs live here,
// never on the company row, so the true margin is always a subtraction.
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("expenses", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  const [{ data: rows }, { data: companies }, { data: devices }] = await Promise.all([
    db()
      .from("expenses")
      .select("*, company:companies(name), staff:users!expenses_staff_user_id_fkey(name, username)")
      .eq("country_id", active?.id ?? "")
      .order("spent_on", { ascending: false })
      .limit(200),
    db().from("companies").select("id, name").eq("country_id", active?.id ?? "").order("name"),
    db().from("device_models").select("id, name").eq("active", true).order("name"),
  ]);
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
          <div>
            <label className="mb-1 block text-xs text-muted">Category</label>
            <select name="category" className="input" required>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Amount</label>
            <MoneyInput name="amount" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Date</label>
            <input name="spent_on" type="date" className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Company (for its true cost)</label>
            <select name="company_id" className="input">
              <option value="">— none —</option>
              {((companies ?? []) as { id: string; name: string }[]).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Device model</label>
            <select name="device_model_id" className="input">
              <option value="">— none —</option>
              {((devices ?? []) as { id: string; name: string }[]).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
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

      <Table head={["Date", "Category", "Tagged To", "Note", "Amount", "Claim", ""]}>
        {list.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">Nothing recorded yet.</td>
          </tr>
        )}
        {list.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-muted">{r.spent_on}</td>
            <td className="px-4 py-2.5">{r.category}</td>
            <td className="px-4 py-2.5 text-muted">
              {[r.company?.name, r.staff ? r.staff.name || r.staff.username : null].filter(Boolean).join(" · ") || "—"}
            </td>
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

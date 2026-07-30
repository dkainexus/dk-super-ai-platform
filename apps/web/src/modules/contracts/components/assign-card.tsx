import Link from "next/link";
import { db } from "@/lib/supabase";
import { assignAccount } from "@/modules/contracts/policy-actions";
import { assignmentDeadline, type AssignmentRow, ASSIGNMENT_SELECT } from "@/modules/contracts/customer-policy";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

/**
 * The platform's assignment card on an account page: who it is offered to,
 * or the form to offer it. Pricing always comes from the customer's own
 * condition table — the form has no price field on purpose.
 */
export async function AssignCard({
  bankAccountId,
  countryId,
  status,
}: {
  bankAccountId: string;
  countryId: string | null;
  status: string;
}) {
  const { data: existing } = await db()
    .from("account_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("bank_account_id", bankAccountId)
    .neq("status", "cancelled")
    .maybeSingle();
  const a = existing as unknown as AssignmentRow | null;

  if (a) {
    const c = a.conditions as { rent?: number; mode?: string; setup_fee?: number; deposit?: number; contract_months?: number | null };
    return (
      <section className="card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Customer Assignment</h2>
        <p className="text-sm">
          {a.customer?.name ?? "?"}{" "}
          <span className="mono-num text-xs text-muted">{a.ref ?? ""}</span> —{" "}
          <span className="capitalize">{a.status.replace("_", " ")}</span>
          {a.status !== "live" && (
            <span className="text-muted"> · billing starts by {assignmentDeadline(a.assigned_on)} at the latest</span>
          )}
          {a.status === "live" && a.live_on && <span className="text-muted"> · billing since {a.live_on}</span>}
        </p>
        <p className="mt-1 text-xs text-muted">
          {fmtNum(Number(c.rent ?? 0))}/mo · setup {fmtNum(Number(c.setup_fee ?? 0))} · insurance {fmtNum(Number(c.deposit ?? 0))} ·{" "}
          {c.contract_months ?? "open"} mo · {a.delivery_method === "shipping" ? "shipping" : "direct binding"} — manage in{" "}
          <Link href="/admin/contracts/assignments" className="text-accent-strong hover:underline">Assignments</Link>
        </p>
      </section>
    );
  }

  if (status !== "active") return null;

  const { data: customers } = await db()
    .from("customers")
    .select("id, name, ref")
    .eq("country_id", countryId ?? "")
    .eq("status", "active")
    .order("name");

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Assign to Customer</h2>
      <p className="mb-3 text-xs text-muted">
        The price comes from the customer&apos;s own condition table — no price is typed here. The customer
        confirms the full agreement in their portal before anything proceeds.
      </p>
      <form action={assignAccount} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <input type="hidden" name="bank_account_id" value={bankAccountId} />
        <div>
          <label className="mb-1 block text-xs text-muted">Customer</label>
          <select name="customer_id" className="input" required>
            <option value="">— Pick the customer —</option>
            {((customers ?? []) as { id: string; name: string; ref: string | null }[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.ref ? ` · ${c.ref}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Delivery</label>
          <select name="delivery_method" className="input">
            <option value="direct">Direct binding (via support)</option>
            <option value="shipping">Shipping</option>
          </select>
        </div>
        <ActionButton icon="send" tip="Offer this account at the customer's own conditions" label="Assign" variant="primary" />
      </form>
    </section>
  );
}

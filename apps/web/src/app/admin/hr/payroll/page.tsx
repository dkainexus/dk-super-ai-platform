import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { createPayrollRun } from "@/modules/hr/actions";
import { payrollNet } from "@/modules/hr/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { fmtNum } from "@/lib/format";

// One run per month per country: open it, tune bonuses and deductions,
// confirm — the payslips are then frozen history.
export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("hr", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("payroll_runs")
    .select("id, period_month, status, confirmed_at, items:payroll_items(base_salary, bonus, deduction)")
    .eq("country_id", active.id)
    .order("period_month", { ascending: false });
  const runs = (data ?? []) as unknown as {
    id: string;
    period_month: string;
    status: string;
    confirmed_at: string | null;
    items: { base_salary: number; bonus: number; deduction: number }[];
  }[];
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/hr" className="text-xs text-muted hover:text-foreground">← Employees</Link>
        <h1 className="mt-1 text-xl font-semibold">Payroll — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          A run opens with everyone on the books at their base salary; adjust, then confirm. Confirmed runs are
          the payslip record — the books are kept by hand.
        </p>
      </div>
      <ErrorBanner message={error} />

      {can(cu, "hr", "add") && (
        <form action={createPayrollRun} className="card flex items-end gap-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-muted">Month</label>
            <input name="period_month" type="month" defaultValue={thisMonth} className="input mono-num" required />
          </div>
          <ActionButton icon="plus" tip="Open this month's run with everyone on the books" label="Open Run" variant="primary" />
        </form>
      )}

      <TableToolbar count={runs.length} noun="run" />
      <Table head={["Month", "People", "Total Net", "Status", ""]}>
        {runs.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-6 text-sm text-muted">No payroll yet — open the first month.</td>
          </tr>
        )}
        {runs.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5">{r.period_month.slice(0, 7)}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{r.items.length}</td>
            <td className="mono-num px-4 py-2.5">
              {fmtNum(r.items.reduce((s, i) => s + payrollNet(i), 0))} {active.currency ?? ""}
            </td>
            <td className="px-4 py-2.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
                  r.status === "confirmed"
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                {r.status}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/hr/payroll/${r.id}`} tip="Open this run" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

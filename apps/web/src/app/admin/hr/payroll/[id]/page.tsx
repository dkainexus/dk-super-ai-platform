import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { savePayrollItem, confirmPayrollRun, deletePayrollRun } from "@/modules/hr/actions";
import { payrollNet } from "@/modules/hr/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table } from "@/components/data-table";
import { fmtNum } from "@/lib/format";

export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("hr", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { data: run } = await db()
    .from("payroll_runs")
    .select("*, country:countries(name, currency)")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();
  const { data } = await db()
    .from("payroll_items")
    .select("*, employee:employees(name, ref, position, bank_name, bank_account_no)")
    .eq("run_id", id);
  const items = ((data ?? []) as unknown as {
    id: string;
    base_salary: number;
    bonus: number;
    deduction: number;
    note: string | null;
    employee: { name: string; ref: string | null; position: string | null; bank_name: string | null; bank_account_no: string | null } | null;
  }[]).sort((a, b) => (a.employee?.name ?? "").localeCompare(b.employee?.name ?? ""));

  const draft = run.status === "draft";
  const canEdit = Boolean(can(cu, "hr", "edit")) && draft;
  const currency = (run.country as { currency: string | null } | null)?.currency ?? "";
  const total = items.reduce((s, i) => s + payrollNet(i), 0);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/hr/payroll" className="text-xs text-muted hover:text-foreground">← Payroll</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">
            {run.period_month.slice(0, 7)} — {(run.country as { name: string } | null)?.name}
          </h1>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
              draft ? "border-warning/40 bg-warning/10 text-warning" : "border-success/40 bg-success/10 text-success"
            }`}
          >
            {run.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {draft
            ? "Adjust bonuses and deductions, then confirm — after that the payslips never move."
            : `Confirmed ${run.confirmed_at?.slice(0, 10) ?? ""} — this is the payslip record.`}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Confirmed — payslips are on every employee&apos;s page.
        </p>
      )}

      <Table head={["Employee", "Salary Account", "Base", "Bonus", "Deduction", "Net", "Note", canEdit ? "" : null].filter((h): h is string => h !== null)}>
        {items.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">Nobody was on the books when this run opened.</td>
          </tr>
        )}
        {items.map((i) =>
          canEdit ? (
            <tr key={i.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5">
                <p className="text-sm font-medium">{i.employee?.name}</p>
                <p className="mono-num text-[11px] text-muted">{i.employee?.position ?? ""}</p>
              </td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {[i.employee?.bank_name, i.employee?.bank_account_no].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-4 py-2.5">
                <MoneyInput name="base_salary" defaultValue={i.base_salary} form={`pi-${i.id}`} className="input mono-num w-28 py-1 text-sm" />
              </td>
              <td className="px-4 py-2.5">
                <MoneyInput name="bonus" defaultValue={i.bonus} form={`pi-${i.id}`} className="input mono-num w-24 py-1 text-sm" />
              </td>
              <td className="px-4 py-2.5">
                <MoneyInput name="deduction" defaultValue={i.deduction} form={`pi-${i.id}`} className="input mono-num w-24 py-1 text-sm" />
              </td>
              <td className="mono-num px-4 py-2.5 font-medium">{fmtNum(payrollNet(i))}</td>
              <td className="px-4 py-2.5">
                <input name="note" defaultValue={i.note ?? ""} form={`pi-${i.id}`} className="input w-36 py-1 text-sm" />
              </td>
              <td className="px-4 py-2.5 text-right">
                <form id={`pi-${i.id}`} action={savePayrollItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="run_id" value={id} />
                  <ActionButton icon="save" tip="Save this line" variant="outline" />
                </form>
              </td>
            </tr>
          ) : (
            <tr key={i.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5">
                <p className="text-sm font-medium">{i.employee?.name}</p>
                <p className="mono-num text-[11px] text-muted">{i.employee?.position ?? ""}</p>
              </td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {[i.employee?.bank_name, i.employee?.bank_account_no].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="mono-num px-4 py-2.5">{fmtNum(i.base_salary)}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(i.bonus)}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(i.deduction)}</td>
              <td className="mono-num px-4 py-2.5 font-medium">{fmtNum(payrollNet(i))}</td>
              <td className="px-4 py-2.5 text-muted">{i.note ?? "—"}</td>
            </tr>
          )
        )}
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mono-num text-sm">
          Total net: <b>{fmtNum(total)} {currency}</b>
        </p>
        {can(cu, "hr", "edit") && draft && (
          <div className="flex items-center gap-3">
            {can(cu, "hr", "delete") && (
              <form action={deletePayrollRun}>
                <input type="hidden" name="id" value={id} />
                <ActionButton icon="trash" tip="Throw this draft away" variant="danger" />
              </form>
            )}
            <form action={confirmPayrollRun}>
              <input type="hidden" name="id" value={id} />
              <ActionButton icon="check" tip="Freeze the payslips — pay by hand from this list" label="Confirm Run" variant="success" />
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

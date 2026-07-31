import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { departmentsFor, employee, isOnPayroll, payrollNet } from "@/modules/hr/lib";
import {
  updateEmployee,
  setEmployeeStatus,
  createEmployeeLogin,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from "@/modules/hr/actions";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { Table } from "@/components/data-table";
import { AuditLine } from "@/components/audit-line";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  probation: "border-warning/40 bg-warning/10 text-warning",
  active: "border-success/40 bg-success/10 text-success",
  resigned: "border-border text-muted",
  terminated: "border-danger/40 bg-danger/10 text-danger",
};

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("hr", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const e = await employee(id);
  if (!e) notFound();

  const [departments, { data: roles }, { data: docs }, { data: claims }, { data: slips }] = await Promise.all([
    departmentsFor(e.country_id),
    db().from("roles").select("id, name").eq("level", "platform").order("name"),
    db().from("employee_documents").select("*").eq("employee_id", e.id).order("uploaded_at", { ascending: false }),
    e.user_id
      ? db()
          .from("expenses")
          .select("id, category, item, amount, currency, spent_on, claim_status")
          .eq("staff_user_id", e.user_id)
          .eq("is_claim", true)
          .order("spent_on", { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [] }),
    db()
      .from("payroll_items")
      .select("base_salary, bonus, deduction, note, run:payroll_runs(period_month, status)")
      .eq("employee_id", e.id)
      .order("id", { ascending: false })
      .limit(24),
  ]);
  const docLinks = new Map<string, string | null>();
  for (const d of (docs ?? []) as { id: string; path: string }[]) {
    docLinks.set(d.id, await signedUrl(DOCS_BUCKET, d.path, 1800));
  }
  const canEdit = Boolean(can(cu, "hr", "edit"));
  const onBooks = isOnPayroll(e.status);
  const payslips = ((slips ?? []) as unknown as {
    base_salary: number;
    bonus: number;
    deduction: number;
    note: string | null;
    run: { period_month: string; status: string } | null;
  }[]).filter((s) => s.run?.status === "confirmed");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/hr" className="text-xs text-muted hover:text-foreground">← Employees</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{e.name}</h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[e.status]}`}>
            {e.status}
          </span>
          {e.ref && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{e.ref}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {[e.department?.name, e.position].filter(Boolean).join(" · ") || "No department yet"} · hired {e.hired_on}
          {e.left_on ? ` · left ${e.left_on}` : ""}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      {/* ---------- profile ---------- */}
      <section className="card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Profile</h2>
        <form action={updateEmployee} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={e.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">Full name</label>
            <input name="name" defaultValue={e.name} className="input" disabled={!canEdit} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">National ID / passport</label>
            <input name="national_id" defaultValue={e.national_id ?? ""} className="input mono-num" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Phone</label>
            <input name="phone" defaultValue={e.phone ?? ""} className="input mono-num" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input name="email" type="email" defaultValue={e.email ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Department</label>
            <select name="department_id" defaultValue={e.department_id ?? ""} className="input" disabled={!canEdit}>
              <option value="">— none —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Position</label>
            <input name="position" defaultValue={e.position ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Hired on</label>
            <input name="hired_on" type="date" defaultValue={e.hired_on} className="input mono-num" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Base salary / month ({e.currency ?? ""})</label>
            <MoneyInput name="base_salary" defaultValue={e.base_salary} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Salary bank</label>
            <input name="bank_name" defaultValue={e.bank_name ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Salary account no.</label>
            <input name="bank_account_no" defaultValue={e.bank_account_no ?? ""} className="input mono-num" disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea name="notes" defaultValue={e.notes ?? ""} rows={2} className="input" disabled={!canEdit} />
          </div>
          {canEdit && (
            <div className="sm:col-span-full">
              <SaveButton tip="Save the profile" />
            </div>
          )}
        </form>
      </section>

      {/* ---------- login + lifecycle ---------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Console login</h2>
          {e.login ? (
            <p className="text-sm">
              <span className="mono-num">{e.login.username}</span>{" "}
              <span className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] ${e.login.active ? "border-success/40 text-success" : "border-border text-muted"}`}>
                {e.login.active ? "enabled" : "disabled"}
              </span>
            </p>
          ) : canEdit && onBooks ? (
            <form action={createEmployeeLogin} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <input type="hidden" name="id" value={e.id} />
              <div>
                <label className="mb-1 block text-xs text-muted">Username</label>
                <input name="username" className="input" autoComplete="off" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">First password</label>
                <input name="password" type="text" className="input mono-num" autoComplete="off" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Role</label>
                <select name="role_id" className="input" required>
                  <option value="">— pick —</option>
                  {((roles ?? []) as { id: string; name: string }[]).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <ActionButton icon="plus" tip="Create the console login" label="Create Login" variant="outline" />
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">No login — this person never touches the console.</p>
          )}
        </section>

        {canEdit && (
          <section className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</h2>
            <div className="flex flex-wrap items-end gap-3">
              {e.status === "probation" && (
                <form action={setEmployeeStatus}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="status" value="active" />
                  <ActionButton icon="check" tip="Probation passed — they are staff now" label="Confirm Staff" variant="success" />
                </form>
              )}
              {onBooks && (
                <>
                  <form action={setEmployeeStatus} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value="resigned" />
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Last day</label>
                      <input name="left_on" type="date" className="input mono-num" />
                    </div>
                    <ActionButton icon="power" tip="They resigned — the login switches off with them" label="Resigned" variant="outline" />
                  </form>
                  <form action={setEmployeeStatus} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value="terminated" />
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Last day</label>
                      <input name="left_on" type="date" className="input mono-num" />
                    </div>
                    <ActionButton icon="x" tip="Let go — the login switches off with them" label="Terminated" variant="danger" />
                  </form>
                </>
              )}
              {!onBooks && (
                <form action={setEmployeeStatus}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="status" value="active" />
                  <ActionButton icon="check" tip="Back on the books — the login switches on again" label="Rehire" variant="outline" />
                </form>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ---------- documents ---------- */}
      <section className="card space-y-3 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Documents</h2>
        {(docs ?? []).length === 0 && <p className="text-sm text-muted">Nothing on file yet.</p>}
        {((docs ?? []) as { id: string; name: string; uploaded_at: string }[]).map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm">{d.name}</p>
              <p className="mono-num text-[11px] text-muted">{d.uploaded_at.slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-2">
              {docLinks.get(d.id) && (
                <a
                  href={docLinks.get(d.id)!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent-strong underline"
                >
                  open ↗
                </a>
              )}
              {can(cu, "hr", "delete") && (
                <form action={deleteEmployeeDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="employee_id" value={e.id} />
                  <ActionButton icon="trash" tip="Remove this document" variant="danger" />
                </form>
              )}
            </div>
          </div>
        ))}
        {canEdit && (
          <form action={uploadEmployeeDocument} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <input type="hidden" name="employee_id" value={e.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input name="name" className="input w-52" placeholder="e.g. Employment contract" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">File</label>
              <input name="file" type="file" accept="image/*,.pdf" className="input" required />
            </div>
            <ActionButton icon="upload" tip="Attach to this employee" label="Upload" variant="outline" />
          </form>
        )}
      </section>

      {/* ---------- payslips ---------- */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Payslips</h2>
        <Table head={["Month", "Base", "Bonus", "Deduction", "Net", "Note"]}>
          {payslips.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-muted">No confirmed payroll yet.</td>
            </tr>
          )}
          {payslips.map((s, i) => (
            <tr key={i} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-muted">{s.run?.period_month.slice(0, 7)}</td>
              <td className="mono-num px-4 py-2.5">{fmtNum(s.base_salary)}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(s.bonus)}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{fmtNum(s.deduction)}</td>
              <td className="mono-num px-4 py-2.5 font-medium">{fmtNum(payrollNet(s))} {e.currency ?? ""}</td>
              <td className="px-4 py-2.5 text-muted">{s.note ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </section>

      {/* ---------- claims ---------- */}
      {e.user_id && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Expense claims</h2>
          <Table head={["Date", "Category", "Item", "Amount", "Status"]}>
            {(claims ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-muted">No claims filed.</td>
              </tr>
            )}
            {((claims ?? []) as { id: string; category: string; item: string | null; amount: number; currency: string; spent_on: string; claim_status: string | null }[]).map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-surface-raised">
                <td className="mono-num px-4 py-2.5 text-muted">{c.spent_on}</td>
                <td className="px-4 py-2.5">{c.category}</td>
                <td className="px-4 py-2.5 text-muted">{c.item ?? "—"}</td>
                <td className="mono-num px-4 py-2.5">{fmtNum(c.amount)} {c.currency}</td>
                <td className="px-4 py-2.5 capitalize text-muted">{c.claim_status}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <AuditLine createdBy={e.created_by} createdAt={e.created_at} updatedBy={e.updated_by} updatedAt={e.updated_at} />
    </div>
  );
}

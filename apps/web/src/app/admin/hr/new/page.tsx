import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { departmentsFor } from "@/modules/hr/lib";
import { createEmployee } from "@/modules/hr/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("hr", "add");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const [departments, { data: roles }] = await Promise.all([
    departmentsFor(active.id),
    db().from("roles").select("id, name").eq("level", "platform").order("name"),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/hr" className="text-xs text-muted hover:text-foreground">← Employees</Link>
        <h1 className="mt-1 text-xl font-semibold">New Employee — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          The record is the person. Fill the login section only if they need the console — customer support
          does, a driver doesn&apos;t.
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={createEmployee} className="space-y-5">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2">Person</h2>
          <div>
            <label className="mb-1 block text-xs text-muted">Full name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">National ID / passport</label>
            <input name="national_id" className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Phone</label>
            <input name="phone" className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input name="email" type="email" className="input" />
          </div>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2">Job</h2>
          <div>
            <label className="mb-1 block text-xs text-muted">Department</label>
            <select name="department_id" className="input">
              <option value="">— none —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Position</label>
            <input name="position" className="input" placeholder="e.g. Customer Support" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Hired on</label>
            <input name="hired_on" type="date" className="input mono-num" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Base salary / month ({active.currency ?? ""})</label>
            <MoneyInput name="base_salary" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Salary bank</label>
            <input name="bank_name" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Salary account no.</label>
            <input name="bank_account_no" className="input mono-num" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea name="notes" rows={2} className="input" />
          </div>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Console login (optional)</h2>
            <p className="mt-1 text-xs text-muted">
              Leave empty for staff who never touch the system. They must change the password on first sign-in.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Username</label>
            <input name="username" className="input" autoComplete="off" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">First password</label>
            <input name="password" type="text" className="input mono-num" autoComplete="off" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Role</label>
            <select name="role_id" className="input">
              <option value="">— pick —</option>
              {((roles ?? []) as { id: string; name: string }[]).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </section>

        <ActionButton icon="plus" tip="Create this employee" label="Create Employee" variant="primary" />
      </form>
    </div>
  );
}

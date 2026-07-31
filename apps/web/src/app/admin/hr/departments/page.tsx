import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { saveDepartment, toggleDepartment } from "@/modules/hr/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("hr", "view");
  const { error, saved } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("departments")
    .select("id, name, active, headcount:employees(count)")
    .eq("country_id", active.id)
    .order("name");
  const departments = (data ?? []) as unknown as {
    id: string;
    name: string;
    active: boolean;
    headcount: { count: number }[];
  }[];
  const canEdit = Boolean(can(cu, "hr", "edit"));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/hr" className="text-xs text-muted hover:text-foreground">← Employees</Link>
        <h1 className="mt-1 text-xl font-semibold">Departments — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          How the team is organised. Switching one off hides it from new employees without moving anyone.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      <section className="card divide-y divide-border p-5">
        {departments.length === 0 && <p className="pb-4 text-sm text-muted">No departments yet — add the first below.</p>}
        {departments.map((d) => (
          <div key={d.id} className="flex items-end gap-2 py-3">
            {canEdit ? (
              <form action={saveDepartment} className="flex min-w-0 flex-1 items-end gap-2">
                <input type="hidden" name="id" value={d.id} />
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
                  <input name="name" defaultValue={d.name} className="input py-1.5 text-sm" required />
                </div>
                <ActionButton icon="save" tip="Save this department" label="Save" variant="outline" />
              </form>
            ) : (
              <p className="flex-1 text-sm font-medium">{d.name}</p>
            )}
            <div className="flex items-center gap-2 pb-1">
              <span className="mono-num text-xs text-muted">{d.headcount?.[0]?.count ?? 0} people</span>
              <ActiveTag active={d.active} on="Active" off="Off" />
              {canEdit && (
                <form action={toggleDepartment}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="active" value={d.active ? "false" : "true"} />
                  <ActionButton
                    icon="power"
                    tip={d.active ? "Hide from new employees" : "Show again"}
                    variant="outline"
                  />
                </form>
              )}
            </div>
          </div>
        ))}

        {canEdit && (
          <form action={saveDepartment} className="flex items-end gap-2 pt-4">
            <input type="hidden" name="country_id" value={active.id} />
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
              <input name="name" className="input py-1.5 text-sm" placeholder="e.g. Customer Support" required />
            </div>
            <ActionButton icon="plus" tip="Add this department" label="Add" variant="primary" />
          </form>
        )}
      </section>
    </div>
  );
}

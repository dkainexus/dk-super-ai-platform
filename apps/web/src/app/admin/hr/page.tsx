import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { EMPLOYEE_SELECT, departmentsFor, type EmployeeRow } from "@/modules/hr/lib";
import { ErrorBanner } from "@/components/error-banner";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  probation: "border-warning/40 bg-warning/10 text-warning",
  active: "border-success/40 bg-success/10 text-success",
  resigned: "border-border text-muted",
  terminated: "border-danger/40 bg-danger/10 text-danger",
};

// Everyone on the platform's own books — customer support, finance, ops.
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; department?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("hr", "view");
  const { error, department = "", status = "" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const departments = await departmentsFor(active.id, false);
  let q = db().from("employees").select(EMPLOYEE_SELECT).eq("country_id", active.id).order("name");
  if (department) q = q.eq("department_id", department);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as unknown as EmployeeRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Employees — {active.name}</h1>
          <p className="mt-1 text-sm text-muted">
            The platform&apos;s own people. The record is the person; a console login is optional and dies with
            their leaving.
          </p>
        </div>
        {can(cu, "hr", "add") && (
          <Link
            href="/admin/hr/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Employee
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="employee">
        <FilterForm action="/admin/hr">
          <FilterSelect
            label="Department"
            name="department"
            value={department}
            options={[{ value: "", label: "All" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All" },
              { value: "probation", label: "Probation" },
              { value: "active", label: "Active" },
              { value: "resigned", label: "Resigned" },
              { value: "terminated", label: "Terminated" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Name", "Department", "Position", "Hired", "Base Salary", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">Nobody yet — add the first employee.</td>
          </tr>
        )}
        {rows.map((e) => (
          <tr key={e.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{e.ref ?? "—"}</td>
            <td className="px-4 py-2.5">
              <p className="font-medium">{e.name}</p>
              {e.login && <p className="mono-num text-[11px] text-muted">{e.login.username}</p>}
            </td>
            <td className="px-4 py-2.5 text-muted">{e.department?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{e.position ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{e.hired_on}</td>
            <td className="mono-num px-4 py-2.5">{fmtNum(e.base_salary)} {e.currency ?? ""}</td>
            <td className="px-4 py-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[e.status]}`}>
                {e.status}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/hr/${e.id}`} tip="Open this employee" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

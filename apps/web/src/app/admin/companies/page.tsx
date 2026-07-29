import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { CompanyStatusTag } from "@/components/status-tag";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { Pagination, pageParams } from "@/components/pagination";
import { requireCountryScope } from "@/modules/countries/lib";
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from "@/lib/types";

type Row = Company & {
  ref: string | null;
  merchant: { name: string } | null;
  members: { role: string; owner: { full_name: string | null } | null }[];
};

// Companies list view: country comes from the back-office scope; the filters
// that matter here are white label, status and province.
export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; merchant?: string; province?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("companies", "view");
  const sp = await searchParams;
  const { status = "", merchant = "", province = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  const { data: merchantRows } = await db()
    .from("merchants")
    .select("id, name, merchant_countries(country_id)")
    .order("name");
  const merchants = ((merchantRows ?? []) as { id: string; name: string; merchant_countries: { country_id: string }[] }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ value: m.id, label: m.name }));

  let pq = db().from("companies").select("province").not("province", "is", null);
  if (active) pq = pq.eq("country_id", active.id);
  const { data: provinceRows } = await pq;
  const provinces = [
    ...new Set(((provinceRows ?? []) as { province: string | null }[]).map((r) => r.province).filter(Boolean) as string[]),
  ].sort();

  let q = db()
    .from("companies")
    .select("*, merchant:merchants(name), members:company_members(role, owner:owners(full_name))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) q = q.eq("status", status);
  if (merchant) q = q.eq("merchant_id", merchant);
  if (province) q = q.eq("province", province);
  if (active) q = q.eq("country_id", active.id);
  const { data, count } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? rows.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="mt-1 text-sm text-muted">
            {active ? `${active.name} only — switch country in the sidebar.` : "All countries."}
          </p>
        </div>
        {can(cu, "companies", "add") && (
          <Link
            href="/admin/companies/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Company
          </Link>
        )}
      </div>

      <TableToolbar count={total} noun="company">
        <FilterForm action="/admin/companies">
          <FilterSelect
            label="White Label"
            name="merchant"
            value={merchant}
            options={[{ value: "", label: "All white labels" }, ...merchants]}
          />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              ...Object.entries(COMPANY_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterSelect
            label="State / Province"
            name="province"
            value={province}
            options={[{ value: "", label: "All" }, ...provinces.map((p) => ({ value: p, label: p }))]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Company", "Registration No.", "Owner", "White Label", "State / Province", "Status", "Added", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-sm text-muted">
              No companies match these filters.
            </td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{c.name}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{c.company_id || "—"}</td>
            <td className="px-4 py-2.5 text-muted">
              {c.members?.find((m) => m.role === "owner")?.owner?.full_name ?? "—"}
            </td>
            <td className="px-4 py-2.5 text-muted">{c.merchant?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{c.province || "—"}</td>
            <td className="px-4 py-2.5">
              <CompanyStatusTag status={c.status as CompanyStatus} />
            </td>
            <td className="px-4 py-2.5 text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/companies/${c.id}`} tip={`Open ${c.name}`} />
            </td>
          </tr>
        ))}
      </Table>

      <Pagination
        basePath="/admin/companies"
        params={{ status, merchant, province }}
        page={page}
        perPage={perPage}
        total={total}
      />
    </div>
  );
}

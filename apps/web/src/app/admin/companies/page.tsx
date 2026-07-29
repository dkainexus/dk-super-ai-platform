import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { CompanyStatusTag } from "@/components/status-tag";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { requireCountryScope } from "@/modules/countries/lib";
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from "@/lib/types";

type Row = Company & {
  merchant: { name: string } | null;
  members: { role: string; owner: { full_name: string | null } | null }[];
};

// Companies list view: country comes from the back-office scope; the filters
// that matter here are white label, status and province.
export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; merchant?: string; province?: string }>;
}) {
  const { cu } = await requirePerm("companies", "view");
  const { status = "", merchant = "", province = "" } = await searchParams;
  const { active } = await requireCountryScope();

  const { data: merchantRows } = await db()
    .from("merchants")
    .select("id, name, merchant_countries(country_id)")
    .order("name");
  const merchants = ((merchantRows ?? []) as { id: string; name: string; merchant_countries: { country_id: string }[] }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ value: m.id, label: m.name }));

  let q = db()
    .from("companies")
    .select("*, merchant:merchants(name), members:company_members(role, owner:owners(full_name))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  if (merchant) q = q.eq("merchant_id", merchant);
  if (province) q = q.ilike("province", `%${province}%`);
  if (active) q = q.eq("country_id", active.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

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

      <TableToolbar count={rows.length} noun="company">
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
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Province</label>
            <input
              name="province"
              defaultValue={province}
              placeholder="e.g. Bangkok"
              className="input w-40 py-1.5 text-xs"
            />
          </div>
        </FilterForm>
      </TableToolbar>

      <Table head={["Company", "Registration No.", "Owner", "White Label", "Province", "Status", "Added"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">
              No companies match these filters.
            </td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5">
              <Link href={`/admin/companies/${c.id}`} className="font-medium text-accent-strong hover:underline">
                {c.name}
              </Link>
            </td>
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
          </tr>
        ))}
      </Table>
    </div>
  );
}

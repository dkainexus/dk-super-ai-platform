import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { CompanyStatusTag } from "@/components/status-tag";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm, SearchInput } from "@/components/filter-form";
import { RowSettings } from "@/components/row-actions";
import { Pagination, pageParams } from "@/components/pagination";
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from "@/lib/types";

export default async function MerchantCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; per?: string }>;
}) {
  const { cu, scope } = await requirePerm("companies", "view");
  if (!cu.merchant) redirect("/admin/companies");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("companies", toggles, cu.merchant, active)) redirect("/m");

  const sp = await searchParams;
  const { status = "", q: search = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);

  let q = db()
    .from("companies")
    .select("*, members:company_members(role, owner:owners(full_name))", { count: "exact" })
    .eq("merchant_id", cu.merchant.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (active) q = q.eq("country_id", active.id);
  if (scope === "own") q = q.eq("created_by", cu.user.id);
  if (status) q = q.eq("status", status);
  const needle = search.trim().replace(/[,()%]/g, "");
  if (needle) q = q.or(`name.ilike.%${needle}%,ref.ilike.%${needle}%,company_id.ilike.%${needle}%`);
  const { data: companies, count } = await q;
  const total = count ?? (companies ?? []).length;

  type Row = Company & { members: { role: string; owner: { full_name: string | null } | null }[] };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Companies{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>

      <TableToolbar count={total} noun="company">
        <FilterForm action="/m/companies">
          <SearchInput placeholder="Name, ref, registration no…" defaultValue={search} />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[["", "All statuses"], ...Object.entries(COMPANY_STATUS_LABEL)].map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Name", "Registration No.", "Bound Owner", "Province", "Status", ""]}>
        {(companies ?? []).length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">No companies match.</td>
          </tr>
        )}
        {((companies ?? []) as Row[]).map((c) => {
          const boundOwner = c.members?.find((m) => m.role === "owner")?.owner?.full_name;
          return (
            <tr key={c.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
              <td className="px-4 py-2.5 font-medium">{c.name}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{c.company_id ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">{boundOwner ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">{c.province ?? "—"}</td>
              <td className="px-4 py-2.5">
                <CompanyStatusTag status={c.status as CompanyStatus} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <RowSettings href={`/m/companies/${c.id}`} tip="Open this company" />
              </td>
            </tr>
          );
        })}
      </Table>

      <Pagination basePath="/m/companies" params={{ status, q: search }} page={page} perPage={perPage} total={total} />
    </div>
  );
}

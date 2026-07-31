import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { agentForUser } from "@/modules/agents/lib";
import { OwnerStatusTag } from "@/components/status-tag";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm, SearchInput } from "@/components/filter-form";
import { RowSettings } from "@/components/row-actions";
import { Pagination, pageParams } from "@/components/pagination";
import { OWNER_STATUS_LABEL, type Owner, type OwnerStatus } from "@/lib/types";

export default async function MerchantOwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; per?: string }>;
}) {
  const cu = await requireMerchantUser();
  const scope = (await requirePerm("owners", "view")).scope;
  const merchant = cu.merchant;
  const { active } = await activeCountry(cu);
  // Only an agent enters owners — the white label itself just watches.
  const selfAgent = await agentForUser(cu.user.id);

  const sp = await searchParams;
  const { status = "", q: search = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);

  let q = db()
    .from("owners")
    .select("*", { count: "exact" })
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (active) q = q.eq("country_id", active.id);
  if (scope === "own") q = q.eq("created_by", cu.user.id);
  if (status) q = q.eq("status", status);
  const needle = search.trim().replace(/[,()%]/g, "");
  if (needle)
    q = q.or(`full_name.ilike.%${needle}%,id_number.ilike.%${needle}%,phone.ilike.%${needle}%,ref.ilike.%${needle}%`);
  const { data: owners, count } = await q;
  const total = count ?? (owners ?? []).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owners{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>
        {selfAgent && (
          <Link
            href="/m/owners/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Owner
          </Link>
        )}
      </div>

      <TableToolbar count={total} noun="owner">
        <FilterForm action="/m/owners">
          <SearchInput placeholder="Name, ID, phone, ref…" defaultValue={search} />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[["", "All statuses"], ...Object.entries(OWNER_STATUS_LABEL)].map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Name", "ID Number", "Phone", "Added", "Status", ""]}>
        {(owners ?? []).length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">No owners match.</td>
          </tr>
        )}
        {((owners ?? []) as Owner[]).map((o) => (
          <tr key={o.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{o.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{o.full_name || "(no name yet)"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.id_number || "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.phone || "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.created_at?.slice(0, 10)}</td>
            <td className="px-4 py-2.5">
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/m/owners/${o.id}`} tip="Open this owner" />
            </td>
          </tr>
        ))}
      </Table>

      <Pagination basePath="/m/owners" params={{ status, q: search }} page={page} perPage={perPage} total={total} />
    </div>
  );
}

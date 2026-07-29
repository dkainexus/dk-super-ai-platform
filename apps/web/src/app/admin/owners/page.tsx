import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { adminCountry } from "@/modules/countries/lib";
import type { OwnerStatus } from "@/lib/types";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "draft", label: "Collecting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "banned", label: "Banned" },
];

type Row = {
  id: string;
  full_name: string | null;
  id_number: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  merchant_id: string;
  merchant: { name: string } | null;
  occupation: { name: string } | null;
};

// Owners list view: the country comes from the back-office scope, so the
// filters here are the ones that actually vary — white label and status.
export default async function AdminOwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; merchant?: string }>;
}) {
  const { cu } = await requirePerm("owners", "view");
  const { status = "", merchant = "" } = await searchParams;
  const { active } = await adminCountry();

  let mq = db().from("merchants").select("id, name, merchant_countries(country_id)").order("name");
  const { data: merchantRows } = await mq;
  const merchants = ((merchantRows ?? []) as { id: string; name: string; merchant_countries: { country_id: string }[] }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ value: m.id, label: m.name }));

  let q = db()
    .from("owners")
    .select("id, full_name, id_number, phone, status, created_at, merchant_id, merchant:merchants(name), occupation:occupations(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  if (merchant) q = q.eq("merchant_id", merchant);
  if (active) q = q.eq("country_id", active.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Owners</h1>
          <p className="mt-1 text-sm text-muted">
            {active ? `${active.name} only — switch country in the sidebar.` : "All countries."}
          </p>
        </div>
        {can(cu, "owners", "add") && (
          <Link
            href="/admin/owners/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Owner
          </Link>
        )}
      </div>

      <TableToolbar count={rows.length} noun="owner">
        <FilterForm action="/admin/owners">
          <FilterSelect
            label="White Label"
            name="merchant"
            value={merchant}
            options={[{ value: "", label: "All white labels" }, ...merchants]}
          />
          <FilterSelect label="Status" name="status" value={status} options={STATUSES} />
        </FilterForm>
      </TableToolbar>

      <Table head={["Name", "White Label", "ID Number", "Phone", "Occupation", "Status", "Added"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">
              No owners match these filters.
            </td>
          </tr>
        )}
        {rows.map((o) => (
          <tr key={o.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5">
              <Link href={`/admin/owners/${o.id}`} className="font-medium text-accent-strong hover:underline">
                {o.full_name || "(no name yet)"}
              </Link>
            </td>
            <td className="px-4 py-2.5 text-muted">{o.merchant?.name ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.id_number || "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.phone || "—"}</td>
            <td className="px-4 py-2.5 text-muted">{o.occupation?.name ?? "—"}</td>
            <td className="px-4 py-2.5">
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </td>
            <td className="px-4 py-2.5 text-muted">{new Date(o.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

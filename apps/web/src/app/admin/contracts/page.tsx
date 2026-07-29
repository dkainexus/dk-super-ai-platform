import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { contracts, partyName, renewalState, today } from "@/modules/contracts/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { merchantFilterOptions } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";

const STATUS_STYLE: Record<string, string> = {
  draft: "border-border text-muted",
  active: "border-success/40 bg-success/10 text-success",
  expired: "border-warning/40 bg-warning/10 text-warning",
  terminated: "border-danger/40 bg-danger/10 text-danger",
};

// Every rental agreement — customer, agent and owner — in one list.
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; kind?: string; merchant?: string; status?: string; due?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { error, kind = "", merchant = "", status = "", due = "" } = await searchParams;
  const { active } = await requireCountryScope();

  const [all, merchants] = await Promise.all([
    contracts({ countryId: active?.id, partyType: kind, merchantId: merchant, status }),
    merchantFilterOptions(active?.id ?? null),
  ]);
  const day = today();
  const rows = due ? all.filter((c) => ["open", "closed"].includes(renewalState(c, day))) : all;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Contracts</h1>
          <p className="mt-1 text-sm text-muted">
            {active ? `${active.name} only.` : "All countries."} A contract fixes the term; each account on it
            carries its own rent.
          </p>
        </div>
        {can(cu, "contracts", "add") && (
          <Link
            href="/admin/contracts/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Contract
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="contract">
        <FilterForm action="/admin/contracts">
          <FilterSelect
            label="Kind"
            name="kind"
            value={kind}
            options={[
              { value: "", label: "All kinds" },
              { value: "customer", label: "Customer" },
              { value: "agent", label: "Agent" },
              { value: "owner", label: "Owner" },
            ]}
          />
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
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "terminated", label: "Terminated" },
            ]}
          />
          <FilterSelect
            label="Renewal"
            name="due"
            value={due}
            options={[
              { value: "", label: "Everything" },
              { value: "1", label: "Expiring soon" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "With", "Kind", "White Label", "Term", "Accounts", "Renewal", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-sm text-muted">No contracts match these filters.</td>
          </tr>
        )}
        {rows.map((c) => {
          const renewal = renewalState(c, day);
          return (
            <tr key={c.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{c.ref ?? "—"}</td>
              <td className="px-4 py-2.5 font-medium">{partyName(c)}</td>
              <td className="px-4 py-2.5 capitalize text-muted">{c.party_type}</td>
              <td className="px-4 py-2.5 text-muted">{c.merchant?.name ?? "—"}</td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {c.starts_on ? `${c.starts_on} → ${c.ends_on ?? "…"}` : "—"}
              </td>
              <td className="mono-num px-4 py-2.5 text-muted">{c.contract_accounts?.[0]?.count ?? 0}</td>
              <td className="px-4 py-2.5">
                {renewal === "open" && (
                  <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                    window open
                  </span>
                )}
                {renewal === "closed" && (
                  <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] text-danger">
                    window closed
                  </span>
                )}
                {(renewal === "not_yet" || renewal === "none") && <span className="text-xs text-muted">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[c.status]}`}>
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <RowSettings href={`/admin/contracts/${c.id}`} tip={`Open ${partyName(c)}'s contract`} />
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

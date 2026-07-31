import Link from "next/link";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm, SearchInput } from "@/components/filter-form";
import { RowSettings } from "@/components/row-actions";
import { Pagination } from "@/components/pagination";
import type { AgentRow } from "../lib";

// Shared Agents index for /admin/agents and /m/agents.
export function AgentsList({
  base,
  rows,
  total,
  page,
  perPage,
  status = "",
  q = "",
  error,
  canAdd,
  where,
  showMerchant = true,
}: {
  base: string;
  rows: AgentRow[];
  total: number;
  page: number;
  perPage: number;
  status?: string;
  q?: string;
  error?: string;
  canAdd: boolean;
  /** The country being worked in, for the subtitle. */
  where?: string | null;
  showMerchant?: boolean;
}) {
  const head = ["ID", "Name", ...(showMerchant ? ["White Label"] : []), "Sign-in", "Owners", "Status", ""];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-muted">
            {where ? `Working in ${where}.` : "All countries."} Every owner an agent enters is credited to them.
          </p>
        </div>
        {canAdd && (
          <Link
            href={`${base}/new`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Agent
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={total} noun="agent">
        <FilterForm action={base}>
          <SearchInput placeholder="Name, ref, phone…" defaultValue={q} />
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={head}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={head.length} className="px-4 py-6 text-sm text-muted">No agents match.</td>
          </tr>
        )}
        {rows.map((a) => (
          <tr key={a.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{a.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{a.full_name}</td>
            {showMerchant && <td className="px-4 py-2.5 text-muted">{a.merchant?.name ?? "—"}</td>}
            <td className="mono-num px-4 py-2.5 text-muted">
              {a.user?.username ?? <span className="text-warning">not issued</span>}
            </td>
            <td className="mono-num px-4 py-2.5 text-muted">{a.owners?.[0]?.count ?? 0}</td>
            <td className="px-4 py-2.5">
              <ActiveTag active={a.status === "active"} on="Active" off="Suspended" />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`${base}/${a.id}`} tip={`Open ${a.full_name}`} />
            </td>
          </tr>
        ))}
      </Table>

      <Pagination basePath={base} params={{ status, q }} page={page} perPage={perPage} total={total} />
    </div>
  );
}

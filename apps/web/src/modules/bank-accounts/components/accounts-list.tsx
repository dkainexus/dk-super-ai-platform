import Link from "next/link";
import { STATUS_COLORS, type BankAccountRow } from "../lib";
import { ErrorBanner } from "@/components/error-banner";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { RowSettings } from "@/components/row-actions";
import { Pagination } from "@/components/pagination";
import { fmtNum } from "@/lib/format";

const STATUSES = ["", "pending", "active", "suspended", "closed", "rejected"] as const;

// Bank Accounts index — same shape as the Owners list: filter, table, ⚙ into
// the detail page where review and editing happen.
export function BankAccountsList({
  base,
  error,
  status,
  bank,
  banks,
  rows,
  total,
  counts,
  page,
  perPage,
  canAdd,
}: {
  base: string;
  error?: string;
  status: string;
  bank: string;
  banks: { id: string; name: string; code: string | null }[];
  rows: BankAccountRow[];
  total: number;
  counts: Record<string, number>;
  page: number;
  perPage: number;
  canAdd: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bank Accounts</h1>
          <p className="mt-1 text-sm text-muted">
            Submitted from the app or created here — open one to review, edit or close it.
          </p>
        </div>
        {canAdd && (
          <Link
            href={`${base}/new`}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Bank Account
          </Link>
        )}
      </div>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((f) => (
          <Link
            key={f || "all"}
            href={f ? `${base}?status=${f}` : base}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
              status === f
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f || "all"}
            {f === "pending" && (counts.pending ?? 0) > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-warning">{counts.pending}</span>
            )}
          </Link>
        ))}
      </div>

      <TableToolbar count={total} noun="account">
        <FilterForm action={base}>
          <input type="hidden" name="status" value={status} />
          <FilterSelect
            label="Bank"
            name="bank"
            value={bank}
            options={[
              { value: "", label: "All banks" },
              ...banks.map((b) => ({ value: b.id, label: b.code ? `${b.name} (${b.code})` : b.name })),
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Bank", "Account No.", "Company", "White Label", "Limit", "Condition", "Status", "Added", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={10} className="px-4 py-6 text-sm text-muted">
              No bank accounts match these filters.
            </td>
          </tr>
        )}
        {rows.map((a) => (
          <tr key={a.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{a.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">
              {a.bank?.name ?? "—"}
              {a.bank?.code && <span className="ml-1 text-xs font-normal text-muted">({a.bank.code})</span>}
            </td>
            <td className="mono-num px-4 py-2.5">{a.account_no}</td>
            <td className="px-4 py-2.5 text-muted">{a.company?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{a.merchant?.name ?? "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">
              {a.account_limit != null ? fmtNum(a.account_limit) : "—"}
            </td>
            <td className="px-4 py-2.5 text-muted">{a.condition}</td>
            <td className="px-4 py-2.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_COLORS[a.status]}`}
              >
                {a.status}
              </span>
            </td>
            <td className="px-4 py-2.5 text-muted">{new Date(a.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`${base}/${a.id}`} tip={`Open ${a.account_no}`} />
            </td>
          </tr>
        ))}
      </Table>

      <Pagination basePath={base} params={{ status, bank }} page={page} perPage={perPage} total={total} />
    </div>
  );
}

import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { topupRequestsFor } from "@/modules/billing/topup";
import { recheckTopUpRequest, approveTopUpRequest, rejectTopUpRequest } from "@/modules/billing/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  credited: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

// Customer-reported USDT transfers. Confirmed ones credit themselves — this
// queue is only what the chain couldn't settle on its own.
export default async function TopUpQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; checked?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("billing", "view");
  const { error, saved, checked, status = "pending" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const rows = await topupRequestsFor({ countryId: active.id, status: status || undefined });
  const canEdit = Boolean(can(cu, "billing", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/billing" className="text-xs text-muted hover:text-foreground">← Billing</Link>
        <h1 className="mt-1 text-xl font-semibold">USDT Top-Ups — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Reported TRC20 transfers, verified on chain against this country&apos;s deposit address. Confirmed
          transfers credit the customer&apos;s wallet automatically at the day&apos;s rate — only the unsettled
          ones need a decision here.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "credited" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Credited to the customer&apos;s wallet.
        </p>
      )}
      {checked && (
        <p className="rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm">
          Chain says: {checked}
        </p>
      )}

      <TableToolbar count={rows.length} noun="request">
        <FilterForm action="/admin/billing/topups">
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "pending", label: "Pending" },
              { value: "credited", label: "Credited" },
              { value: "rejected", label: "Rejected" },
              { value: "", label: "All" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["Submitted", "Customer", "Transaction", "Reported", "On Chain", "Status", "Note", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">Nothing here.</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="align-top transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</td>
            <td className="px-4 py-2.5">
              <p className="text-sm font-medium">{r.customer?.name ?? "?"}</p>
              <p className="mono-num text-xs text-muted">{r.customer?.ref ?? ""}</p>
            </td>
            <td className="mono-num max-w-[16rem] break-all px-4 py-2.5 text-xs text-muted">
              <a
                href={`https://tronscan.org/#/transaction/${r.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
                title="Open on TronScan"
              >
                {r.tx_hash}
              </a>
            </td>
            <td className="mono-num px-4 py-2.5 text-sm">{r.amount_usdt != null ? `${fmtNum(r.amount_usdt)} USDT` : "—"}</td>
            <td className="mono-num px-4 py-2.5 text-sm">{r.chain_usdt != null ? `${fmtNum(r.chain_usdt)} USDT` : "—"}</td>
            <td className="px-4 py-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                {r.status}
              </span>
            </td>
            <td className="max-w-[14rem] px-4 py-2.5 text-xs text-muted">{r.verify_note ?? "—"}</td>
            <td className="px-4 py-2.5">
              {canEdit && r.status === "pending" && (
                <div className="flex flex-col items-end gap-2">
                  <form action={recheckTopUpRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <ActionButton icon="link" tip="Ask the chain again" label="Re-check" />
                  </form>
                  <form action={approveTopUpRequest} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="usdt_amount"
                      defaultValue={r.amount_usdt ?? ""}
                      placeholder="USDT"
                      className="input mono-num w-24 py-1 text-xs"
                    />
                    <ActionButton
                      icon="check"
                      tip="Credit this USDT amount by hand — use only when you've confirmed the transfer yourself"
                      label="Credit"
                      variant="success"
                    />
                  </form>
                  <form action={rejectTopUpRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <ActionButton icon="x" tip="Reject this report" label="Reject" variant="danger" />
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

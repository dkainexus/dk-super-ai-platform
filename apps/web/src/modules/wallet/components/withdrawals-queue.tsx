// Withdrawal queue — shared by /admin/wallets/withdrawals and /m/wallets. Every
// request shows the bank snapshot for the manual transfer; the platform marks
// Paid after transferring, or rejects (which refunds the wallet). Tick several
// rows to settle a whole batch in one go.

import { bulkProcessWithdrawals } from "@/modules/wallet/actions";
import { ActionButton } from "@/components/action-buttons";
import { SelectAll } from "@/components/select-all";
import { fmtNum } from "@/lib/format";
import { WITHDRAWAL_STATUS_LABEL, type Withdrawal, type WithdrawalStatus } from "@/lib/types";

const STATUS_STYLE: Record<WithdrawalStatus, string> = {
  pending: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
};

export function WithdrawalStatusTag({ status }: { status: WithdrawalStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {WITHDRAWAL_STATUS_LABEL[status]}
    </span>
  );
}

export function WithdrawalsQueue({
  withdrawals,
  ownerNames,
  canProcess,
  back,
  exportHref,
}: {
  withdrawals: Withdrawal[];
  ownerNames: Map<string, string>;
  canProcess: boolean;
  back: string;
  exportHref?: string;
}) {
  const pending = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <form action={bulkProcessWithdrawals} className="space-y-3">
      <input type="hidden" name="back" value={back} />

      {(canProcess || exportHref) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-2.5">
          {canProcess && pending > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted">
                <SelectAll tip="Select every pending request" /> Select all pending
              </label>
              <input
                name="reason"
                placeholder="Reject reason (rejections only)"
                className="input h-8 w-56 text-xs"
              />
              <ActionButton
                icon="check"
                tip="Mark every ticked request as paid — do this AFTER the bank transfers"
                label="Mark Paid"
                variant="primary"
                name="decision"
                value="paid"
              />
              <ActionButton
                icon="trash"
                tip="Reject every ticked request and refund those wallets"
                label="Reject"
                variant="danger"
                name="decision"
                value="reject"
              />
            </>
          )}
          {exportHref && (
            <a
              href={exportHref}
              className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
              title="Download these withdrawals as a CSV file"
            >
              ↓ Export CSV
            </a>
          )}
        </div>
      )}

      {withdrawals.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No withdrawal requests.</p>}

      {withdrawals.map((w) => (
        <div key={w.id} className={`card p-4 ${w.status === "pending" ? "glow-border" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {canProcess && (
                <input
                  type="checkbox"
                  name="ids"
                  value={w.id}
                  disabled={w.status !== "pending"}
                  title={w.status === "pending" ? "Include in the batch" : "Already processed"}
                  className="h-4 w-4 accent-[var(--accent)] disabled:opacity-30"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {ownerNames.get(w.owner_id) ?? "(unknown owner)"}
                  <span className="mono-num ml-2 text-base font-semibold">
                    {fmtNum(w.amount)} {w.currency}
                  </span>
                </p>
                <p className="mono-num text-xs text-muted">
                  {w.bank_name ?? "—"} · {w.bank_account_no ?? "—"} · requested{" "}
                  {new Date(w.requested_at).toLocaleString()}
                </p>
                {w.status === "rejected" && w.reject_reason && (
                  <p className="text-xs text-danger">Reason: {w.reject_reason}</p>
                )}
              </div>
            </div>
            <WithdrawalStatusTag status={w.status} />
          </div>
        </div>
      ))}
    </form>
  );
}

// Withdrawal queue — shared by /admin/wallets and /m/wallets. Every request
// shows the bank snapshot for the manual transfer; the platform marks Paid
// after transferring, or rejects (which refunds the wallet).

import { processWithdrawal } from "@/modules/wallet/actions";
import { ActionButton } from "@/components/action-buttons";
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
}: {
  withdrawals: Withdrawal[];
  ownerNames: Map<string, string>;
  canProcess: boolean;
  back: string;
}) {
  return (
    <div className="space-y-3">
      {withdrawals.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">No withdrawal requests.</p>
      )}
      {withdrawals.map((w) => (
        <div key={w.id} className={`card p-4 ${w.status === "pending" ? "glow-border" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {ownerNames.get(w.owner_id) ?? "(unknown owner)"}
                <span className="mono-num ml-2 text-base font-semibold">
                  {w.amount.toLocaleString()} {w.currency}
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
            <div className="flex items-center gap-2">
              <WithdrawalStatusTag status={w.status} />
              {canProcess && w.status === "pending" && (
                <>
                  <form action={processWithdrawal}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="decision" value="paid" />
                    <input type="hidden" name="back" value={back} />
                    <ActionButton
                      icon="check"
                      tip="Mark as paid — do this AFTER completing the bank transfer"
                      label="Mark Paid"
                      variant="primary"
                    />
                  </form>
                  <form action={processWithdrawal} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input type="hidden" name="back" value={back} />
                    <input name="reason" placeholder="Reject reason" className="input h-8 w-36 text-xs" />
                    <ActionButton icon="trash" tip="Reject and refund the wallet" label="Reject" variant="danger" />
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

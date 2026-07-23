import Link from "next/link";
import { reviewBankAccount, deleteBankAccount } from "../actions";
import { BankAccountForm, type FormBank, type FormCompany } from "./account-form";
import { STATUS_COLORS, type BankAccountRow } from "../lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";

// Shared view for /admin/bank-accounts and /m/bank-accounts.

const FILTERS = ["", "pending", "active", "suspended", "closed", "rejected"] as const;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mono-num text-sm">{value}</p>
    </div>
  );
}

export function BankAccountsView({
  base,
  error,
  status,
  rows,
  canAdd,
  canEdit,
  canDelete,
  companies,
  banks,
}: {
  base: string;
  error?: string;
  status: string;
  rows: BankAccountRow[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  companies: FormCompany[];
  banks: FormBank[];
}) {
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const shown = status ? rows.filter((r) => r.status === status) : rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Bank Accounts</h1>
        <p className="mt-1 text-sm text-muted">
          Submitted from the app or created here — review, activate, suspend or close.
        </p>
      </div>
      <ErrorBanner message={error} />

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
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
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-warning">{pendingCount}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {shown.length === 0 && (
          <p className="card px-5 py-6 text-sm text-muted">No bank accounts{status ? ` with status "${status}"` : ""} yet.</p>
        )}
        {shown.map((a) => {
          const back = status ? `${base}?status=${status}` : base;
          const enabledChannels = Object.entries(a.channels ?? {})
            .filter(([, v]) => v?.enabled)
            .map(([k, v]) => (v.value ? `${k} (${v.value})` : k));
          return (
            <div
              key={a.id}
              className={`card space-y-3 p-4 ${a.status === "pending" ? "border-warning/40 shadow-[0_0_12px_rgba(245,197,66,0.08)]" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {a.bank?.name ?? "?"}{" "}
                    <span className="mono-num text-xs text-muted">{a.account_no}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {a.company?.name ?? "?"} · {a.merchant?.name ?? "—"}
                    {a.country ? ` · ${a.country.flag ?? ""} ${a.country.name}` : ""} ·{" "}
                    {a.owner ? `by ${a.owner.full_name ?? "owner"} (app)` : "by admin"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_COLORS[a.status]}`}>
                    {a.status}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
                    {a.condition}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Branch" value={a.branch_address} />
                <Field label="Limit" value={a.account_limit != null ? Number(a.account_limit).toLocaleString() : null} />
                <Field label="Email" value={a.email} />
                <Field label="SIM" value={a.sim_number} />
                <Field label="Login / User ID" value={a.login_id} />
                <Field label="Password" value={a.password} />
                {Object.entries(a.extra ?? {}).map(([k, v]) => (
                  <Field key={k} label={k.replaceAll("_", " ")} value={v} />
                ))}
                {enabledChannels.length > 0 && <Field label="Channels" value={enabledChannels.join(", ")} />}
                <Field label="Activated" value={a.activated_at ? new Date(a.activated_at).toLocaleDateString() : null} />
                <Field label="Suspended" value={a.suspended_at ? new Date(a.suspended_at).toLocaleDateString() : null} />
                <Field label="Closed" value={a.closed_at ? new Date(a.closed_at).toLocaleDateString() : null} />
              </div>
              {a.status === "rejected" && a.reject_reason && (
                <p className="text-xs text-danger">Rejected: {a.reject_reason}</p>
              )}

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {a.status === "pending" && (
                    <>
                      <form action={reviewBankAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="approve" />
                        <ActionButton icon="check" tip="Approve — account becomes active" label="Approve" variant="success" />
                      </form>
                      <form action={reviewBankAccount} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="reject" />
                        <input name="reason" placeholder="Reject reason…" className="input w-44 py-1.5 text-xs" />
                        <ActionButton icon="x" tip="Reject with the given reason" label="Reject" variant="danger" />
                      </form>
                    </>
                  )}
                  {a.status === "active" && (
                    <>
                      <form action={reviewBankAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="suspend" />
                        <ActionButton icon="power" tip="Suspend this account" label="Suspend" variant="outline" />
                      </form>
                      <form action={reviewBankAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="close" />
                        <ActionButton icon="x" tip="Close this account permanently" label="Close" variant="outline" />
                      </form>
                    </>
                  )}
                  {a.status === "suspended" && (
                    <>
                      <form action={reviewBankAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="reactivate" />
                        <ActionButton icon="check" tip="Reactivate this account" label="Reactivate" variant="success" />
                      </form>
                      <form action={reviewBankAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="review_action" value="close" />
                        <ActionButton icon="x" tip="Close this account permanently" label="Close" variant="outline" />
                      </form>
                    </>
                  )}
                  {canDelete && (
                    <form action={deleteBankAccount} className="ml-auto">
                      <input type="hidden" name="id" value={a.id} />
                      <ActionButton icon="trash" tip="Delete this record" variant="danger" />
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">New Bank Account</h2>
          <p className="mb-4 text-xs text-muted">
            Pick the company first — banks and their extra fields follow the company&apos;s country.
          </p>
          <BankAccountForm companies={companies} banks={banks} />
        </section>
      )}
    </div>
  );
}

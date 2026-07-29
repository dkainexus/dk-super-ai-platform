import Link from "next/link";
import { reviewBankAccount, deleteBankAccount, assignBranch, editBankAccount } from "../actions";
import { BankAccountForm, type FormBank, type FormCompany } from "./account-form";
import { STATUS_COLORS, type BankAccountRow } from "../lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { BranchPicker } from "@/modules/banks/components/branch-picker";
import { fmtNum } from "@/lib/format";

// Shared view for /admin/bank-accounts and /m/bank-accounts.

const FILTERS = ["", "pending", "active", "suspended", "closed", "rejected"] as const;

export type AccountRow = BankAccountRow;

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
  countryCodes,
}: {
  base: string;
  error?: string;
  status: string;
  rows: AccountRow[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  companies: FormCompany[];
  banks: FormBank[];
  countryCodes: Record<string, string>;
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
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {a.ref && <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-normal text-muted">{a.ref}</span>}
                    {a.bank?.name ?? "?"}{" "}
                    <span className="mono-num text-xs font-normal text-muted">{a.account_no}</span>
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

              {/* Branch */}
              {a.branch_name ? (
                <p className="text-xs">
                  <span className="text-muted">Branch:</span> <span className="font-medium">{a.branch_name}</span>
                  {a.branch_address ? <span className="text-muted"> · {a.branch_address}</span> : null}
                </p>
              ) : (
                canEdit && (
                  <form action={assignBranch} className="flex flex-wrap items-end gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value={back} />
                    <div className="min-w-64 flex-1">
                      <BranchPicker
                        regionCode={countryCodes[a.country_id ?? ""] ?? null}
                        bankName={a.bank?.name ?? null}
                        label="No branch set — search Google Maps"
                        compact
                      />
                    </div>
                    <ActionButton icon="check" tip="Save this branch on the account" label="Set Branch" variant="primary" />
                  </form>
                )
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Limit" value={a.account_limit != null ? fmtNum(a.account_limit) : null} />
                <Field label="Email" value={a.email} />
                <Field label="SIM" value={a.sim_number} />
                <Field label="Login / User ID" value={a.login_id} />
                <Field label="Password" value={a.password} />
                {(a.bank?.account_fields ?? []).map((f) => (
                  <Field key={f.key} label={f.label} value={a.extra?.[f.key]} />
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
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted hover:text-foreground">
                    ✎ Edit details
                  </summary>
                  <form action={editBankAccount} className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value={back} />
                    <div>
                      <label className="mb-1 block text-xs text-muted">Account Number</label>
                      <input name="account_no" defaultValue={a.account_no} className="input mono-num" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Account Limit</label>
                      <MoneyInput name="account_limit" defaultValue={a.account_limit} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Condition</label>
                      <select name="condition" defaultValue={a.condition} className="input">
                        <option value="New">New</option>
                        <option value="Old">Old</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Email</label>
                      <input name="email" type="email" defaultValue={a.email ?? ""} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">SIM Card Number</label>
                      <input name="sim_number" defaultValue={a.sim_number ?? ""} className="input mono-num" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Login / User ID</label>
                      <input name="login_id" defaultValue={a.login_id ?? ""} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Password</label>
                      <input name="password" defaultValue={a.password ?? ""} className="input" />
                    </div>
                    <div className="sm:col-span-3">
                      <BranchPicker
                        regionCode={countryCodes[a.country_id ?? ""] ?? null}
                        bankName={a.bank?.name ?? null}
                        defaultValue={a.branch_name ? { name: a.branch_name, address: a.branch_address } : null}
                      />
                    </div>
                    {(a.bank?.account_fields ?? []).map((f) => (
                      <div key={f.key}>
                        <label className="mb-1 block text-xs text-muted">{f.label}</label>
                        <input name={`extra_${f.key}`} defaultValue={a.extra?.[f.key] ?? ""} className="input" />
                      </div>
                    ))}
                    {(a.bank?.channels ?? []).map((c) => (
                      <div key={c} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name={`channel_${c}`} defaultChecked={a.channels?.[c]?.enabled} /> {c}
                        </label>
                        <input
                          name={`channel_${c}_value`}
                          defaultValue={a.channels?.[c]?.value ?? ""}
                          placeholder="Linked number / ID"
                          className="input flex-1 py-1 text-xs"
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-3">
                      <SaveButton tip="Save the edited details" />
                    </div>
                  </form>
                </details>
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
            Pick the company first — banks, branches and extra fields follow the company&apos;s country.
          </p>
          <BankAccountForm companies={companies} banks={banks} countryCodes={countryCodes} />
        </section>
      )}
    </div>
  );
}

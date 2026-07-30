import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { ticket, escortThreshold, ASSIGNEE_LABEL } from "@/modules/tickets/lib";
import {
  assignTicket,
  addTicketMessage,
  closeTicket,
  waiveCharge,
  setAccountFreeze,
} from "@/modules/tickets/actions";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

type Message = {
  id: string;
  author_type: "customer" | "staff" | "owner";
  body: string | null;
  attachment_path: string | null;
  created_at: string;
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("tickets", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const t = await ticket(id);
  if (!t) notFound();

  const [{ data: messageRows }, threshold] = await Promise.all([
    db().from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at"),
    escortThreshold(t.merchant_id, t.country_id),
  ]);
  const messages = (messageRows ?? []) as Message[];
  const attachments = new Map<string, string | null>();
  for (const m of messages) {
    if (m.attachment_path) attachments.set(m.id, await signedUrl(DOCS_BUCKET, m.attachment_path, 1800));
  }

  const canEdit = Boolean(can(cu, "tickets", "edit"));
  const closed = t.status === "handled" || t.status === "resolved";
  const overThreshold =
    threshold != null && t.reported_balance != null && Number(t.reported_balance) >= threshold;
  const back = `/admin/tickets/${t.id}`;
  const frozen = Boolean(t.bank_account?.billing_frozen);

  const AUTHOR_STYLE: Record<string, string> = {
    customer: "border-accent/40 bg-accent-soft",
    staff: "border-border bg-surface-raised",
    owner: "border-success/40 bg-success/10",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/tickets" className="text-xs text-muted hover:text-foreground">← Support</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{t.type?.name ?? "Ticket"}</h1>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
            {t.status}
          </span>
          {t.ref && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{t.ref}</span>
          )}
          {frozen && (
            <span className="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-[11px] text-danger">
              billing frozen
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {t.bank_account?.bank?.name ?? "?"} {t.bank_account?.account_no} · {t.customer?.name ?? "?"} · reported{" "}
          {new Date(t.created_at).toLocaleString()}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Closed as {saved === "resolved" ? "resolved" : "handled (still unusable)"}
          {t.charge_amount ? ` — ${fmtNum(t.charge_amount)} joins the next invoice unless waived.` : "."}
        </p>
      )}

      {/* What the customer filed */}
      <section className="card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">As reported</h2>
        <p className="whitespace-pre-wrap text-sm">{t.description}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Balance at report</p>
            <p className="mono-num">
              {t.reported_balance != null ? fmtNum(t.reported_balance) : "—"}
              {overThreshold && (
                <span className="ml-2 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                  over escort threshold {fmtNum(threshold!)}
                </span>
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Last transaction</p>
            <p className="mono-num">{t.last_transaction || "—"}</p>
          </div>
        </div>
      </section>

      {/* Triage */}
      {canEdit && !closed && (
        <section className="card p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {t.status === "open" ? "Assign" : `Assigned to ${ASSIGNEE_LABEL[t.assigned_to ?? ""] ?? "—"} — reassign`}
          </h2>
          <p className="mb-4 text-xs text-muted">
            Owner and Phone CS are chargeable when the ticket closes; sending it back to the customer for
            documents is not. {overThreshold && <b>This balance requires an escort with the owner.</b>}
          </p>
          <form action={assignTicket} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <input type="hidden" name="id" value={t.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Handled by</label>
              <select name="assigned_to" defaultValue={t.assigned_to ?? ""} className="input" required>
                <option value="">— Pick —</option>
                <option value="owner">Owner (goes to the bank)</option>
                <option value="phone_cs">Phone CS (a call resolves it)</option>
                <option value="customer">Customer (supplies documents)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Window (days)</label>
              <input name="window_days" type="number" min={1} defaultValue={14} className="input mono-num" />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-muted">
                Escort {overThreshold ? "(required)" : "(only above the threshold)"}
              </label>
              <input name="escort_name" defaultValue={t.escort_name ?? ""} placeholder="Who goes along" className="input" />
            </div>
            <ActionButton icon="check" tip="Assign with this deadline — the owner is notified in the app" label="Assign" variant="primary" />
          </form>
          {t.deadline && (
            <p className="mono-num mt-3 text-xs text-muted">
              Current deadline {t.deadline} — past it unhandled, the account freezes on its own.
            </p>
          )}
        </section>
      )}

      {/* Conversation & evidence */}
      <section className="card space-y-3 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Conversation & evidence</h2>
        {messages.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-xl border p-3 ${AUTHOR_STYLE[m.author_type]}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {m.author_type} · {new Date(m.created_at).toLocaleString()}
            </p>
            {m.body && <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>}
            {m.attachment_path && attachments.get(m.id) && (
              <a
                href={attachments.get(m.id)!}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-accent-strong underline"
              >
                Attachment ↗
              </a>
            )}
          </div>
        ))}
        {canEdit && (
          <form action={addTicketMessage} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
            <input type="hidden" name="id" value={t.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Reply</label>
              <input name="body" className="input" placeholder="What happened…" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Evidence (recording, file, photo)</label>
              <input name="attachment" type="file" className="input" />
            </div>
            <ActionButton icon="send" tip="Add this to the record" label="Add" />
          </form>
        )}
      </section>

      {/* Closing & the charge */}
      {canEdit && (
        <section className="card flex flex-wrap items-center gap-3 p-5">
          {!closed ? (
            <>
              <form action={closeTicket}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="outcome" value="resolved" />
                <ActionButton icon="check" tip="Fixed — the account works again. The service charge is raised." label="Mark Resolved" variant="success" />
              </form>
              <form action={closeTicket}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="outcome" value="handled" />
                <ActionButton
                  icon="power"
                  tip="Handled in time but the account still does not work — rent keeps running either way"
                  label="Handled (still unusable)"
                />
              </form>
            </>
          ) : (
            <p className="text-sm text-muted">
              {t.charge_amount
                ? t.charge_waived
                  ? `Charge of ${fmtNum(t.charge_amount)} waived.`
                  : t.charge_invoiced_at
                    ? `Charge of ${fmtNum(t.charge_amount)} is on an invoice.`
                    : `Charge of ${fmtNum(t.charge_amount)} (${t.charge_kind === "phone" ? "phone" : "visit"}) joins the next run.`
                : "No charge on this ticket."}
            </p>
          )}
          {closed && t.charge_amount && !t.charge_waived && !t.charge_invoiced_at && (
            <form action={waiveCharge}>
              <input type="hidden" name="id" value={t.id} />
              <ActionButton icon="x" tip="This one should not be charged" label="Waive Charge" />
            </form>
          )}
          <form action={setAccountFreeze} className="ml-auto flex items-end gap-2">
            <input type="hidden" name="bank_account_id" value={t.bank_account_id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="freeze" value={frozen ? "0" : "1"} />
            {!frozen && <input name="reason" placeholder="Why freeze…" className="input w-44 py-1.5 text-xs" />}
            <ActionButton
              icon="power"
              tip={
                frozen
                  ? "Billing resumes for months starting after now"
                  : "Stop billing everyone for this account from next month — the term keeps running"
              }
              label={frozen ? "Unfreeze Account" : "Freeze Account"}
              variant={frozen ? "outline" : "danger"}
            />
          </form>
        </section>
      )}
    </div>
  );
}

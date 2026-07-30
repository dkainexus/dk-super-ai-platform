import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { replyTicket } from "@/app/portal/actions";
import { signedUrl, DOCS_BUCKET } from "@/lib/storage";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";

export default async function PortalTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { data } = await db()
    .from("tickets")
    .select("*, bank_account:bank_accounts(account_no, bank:banks(name)), type:ticket_types(name)")
    .eq("id", id)
    .eq("customer_id", c.id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as unknown as {
    id: string; ref: string | null; status: string; description: string; created_at: string;
    assigned_to: string | null;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
    type: { name: string } | null;
  };

  const { data: messageRows } = await db()
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", t.id)
    .order("created_at");
  const messages = (messageRows ?? []) as {
    id: string; author_type: string; body: string | null; attachment_path: string | null; created_at: string;
  }[];
  const attachments = new Map<string, string | null>();
  for (const m of messages) {
    if (m.attachment_path) attachments.set(m.id, await signedUrl(DOCS_BUCKET, m.attachment_path, 1800));
  }
  const closed = t.status === "handled" || t.status === "resolved";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/portal/support" className="text-xs text-muted hover:text-foreground">← Support</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{t.type?.name ?? "Problem"}</h1>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
            {t.status}
          </span>
          {t.ref && <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{t.ref}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {t.bank_account?.bank?.name ?? "?"} {t.bank_account?.account_no} · {new Date(t.created_at).toLocaleString()}
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Reported — we will take a look and let you know who is handling it.
        </p>
      )}
      {t.assigned_to === "customer" && !closed && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          The bank needs documents from you — please attach them below.
        </p>
      )}

      <section className="card space-y-3 p-5">
        <p className="whitespace-pre-wrap text-sm">{t.description}</p>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-3 ${
              m.author_type === "customer" ? "border-accent/40 bg-accent-soft" : "border-border bg-surface-raised"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {m.author_type === "customer" ? "You" : "Support"} · {new Date(m.created_at).toLocaleString()}
            </p>
            {m.body && <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>}
            {m.attachment_path && attachments.get(m.id) && (
              <a href={attachments.get(m.id)!} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent-strong underline">
                Attachment ↗
              </a>
            )}
          </div>
        ))}
      </section>

      {!closed && (
        <form action={replyTicket} className="card grid gap-3 p-5 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
          <input type="hidden" name="ticket_id" value={t.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">Reply</label>
            <input name="body" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Attach a file</label>
            <input name="attachment" type="file" className="input" />
          </div>
          <ActionButton icon="send" tip="Send" label="Send" variant="primary" />
        </form>
      )}
    </div>
  );
}

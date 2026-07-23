import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { sendNotification, deleteNotification } from "@/modules/notifications/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { NOTIFICATION_TYPE_LABEL, type AppNotification, type Country, type Merchant, type NotificationType } from "@/lib/types";

const TYPE_COLORS: Record<NotificationType, string> = {
  general: "border-border text-muted",
  company: "border-accent/40 text-accent-strong",
  reward: "border-warning/40 text-warning",
  training: "border-success/40 text-success",
  exam: "border-danger/40 text-danger",
};

// Notifications module (platform side): compose + full send history.
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { cu } = await requirePerm("notifications", "view");
  const { error, sent } = await searchParams;

  const [{ data: rows }, { data: merchants }, { data: countries }, { data: owners }] = await Promise.all([
    db()
      .from("notifications")
      .select("*, owner:owners(full_name, merchant_id)")
      .order("created_at", { ascending: false })
      .limit(100),
    db().from("merchants").select("*").eq("status", "active").order("name"),
    db().from("countries").select("*").eq("active", true).order("sort"),
    db().from("owners").select("id, full_name, status").neq("status", "banned").order("full_name"),
  ]);
  const list = (rows ?? []) as (AppNotification & { owner: { full_name: string | null } | null })[];
  const canAdd = can(cu, "notifications", "add");
  const canDelete = can(cu, "notifications", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-muted">
          In-app notifications owners see on their phone — company updates, rewards, training news.
        </p>
      </div>
      <ErrorBanner message={error} />
      {sent && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sent to {sent} owner{sent === "1" ? "" : "s"}.
        </p>
      )}

      {canAdd && (
        <form action={sendNotification} className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Send notification</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Type</label>
              <select name="type" className="input">
                {Object.entries(NOTIFICATION_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Specific owner (optional)</label>
              <select name="owner_id" className="input">
                <option value="">— audience below —</option>
                {((owners ?? []) as { id: string; full_name: string | null }[]).map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name ?? "(unnamed)"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Audience — White Label</label>
              <select name="merchant_id" className="input">
                <option value="">All white labels</option>
                {((merchants ?? []) as Merchant[]).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Audience — Country</label>
              <select name="country_id" className="input">
                <option value="">All countries</option>
                {((countries ?? []) as Country[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Title</label>
              <input name="title" className="input" placeholder="e.g. Your company has been registered 🎉" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">Message</label>
              <textarea name="body" rows={3} className="input" placeholder="Optional details" />
            </div>
          </div>
          <ActionButton icon="send" tip="Send this notification" label="Send" variant="primary" />
        </form>
      )}

      <div className="card divide-y divide-border">
        {list.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nothing sent yet.</p>}
        {list.map((n) => (
          <div key={n.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TYPE_COLORS[n.type]}`}>
                  {NOTIFICATION_TYPE_LABEL[n.type]}
                </span>
                <p className="truncate text-sm font-medium">{n.title}</p>
                {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unread" />}
              </div>
              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
              <p className="mt-0.5 text-xs text-muted">
                → {n.owner?.full_name ?? "(deleted owner)"} · {new Date(n.created_at).toLocaleString()}
                {n.read_at ? " · read" : ""}
              </p>
            </div>
            {canDelete && (
              <form action={deleteNotification}>
                <input type="hidden" name="id" value={n.id} />
                <ActionButton icon="trash" tip="Delete this notification" variant="danger" />
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

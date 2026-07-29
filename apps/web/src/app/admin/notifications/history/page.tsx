import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { sendNotification, deleteNotification } from "@/modules/notifications/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { type AppNotification, type Merchant } from "@/lib/types";
import { requireCountryScope } from "@/modules/countries/lib";

// Notifications module (platform side): compose + full send history.
export default async function NotificationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { cu } = await requirePerm("notifications", "view");
  const { error, sent } = await searchParams;

  const { active } = await requireCountryScope();
  let ownerQuery = db().from("owners").select("id, full_name, status").neq("status", "banned").order("full_name");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);

  const [{ data: rows }, { data: merchants }, { data: owners }] = await Promise.all([
    db()
      .from("notifications")
      .select("*, owner:owners(full_name, merchant_id)")
      .order("created_at", { ascending: false })
      .limit(100),
    db().from("merchants").select("*").eq("status", "active").order("name"),
    ownerQuery,
  ]);
  const list = (rows ?? []) as (AppNotification & { owner: { full_name: string | null } | null })[];
  const canAdd = can(cu, "notifications", "add");
  const canDelete = can(cu, "notifications", "delete");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/notifications" className="text-xs text-muted hover:text-foreground">← App Notification</Link>
        <h1 className="mt-1 text-xl font-semibold">Notification History</h1>
        <p className="mt-1 text-sm text-muted">
          Everything sent to owners&apos; phones, newest first.
        </p>
      </div>
      <ErrorBanner message={error} />
      {sent && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sent to {sent} owner{sent === "1" ? "" : "s"}.
        </p>
      )}

      <div className="card divide-y divide-border">
        {list.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nothing sent yet.</p>}
        {list.map((n) => (
          <div key={n.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
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

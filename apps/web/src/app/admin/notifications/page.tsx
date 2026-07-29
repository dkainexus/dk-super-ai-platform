import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { sendNotification } from "@/modules/notifications/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { type Merchant } from "@/lib/types";
import { requireCountryScope } from "@/modules/countries/lib";

// Notifications module (platform side): compose + full send history.
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { cu } = await requirePerm("notifications", "view");
  const { error, sent } = await searchParams;

  const { active } = await requireCountryScope();
  let ownerQuery = db().from("owners").select("id, full_name, status").neq("status", "banned").order("full_name");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);

  const [{ data: merchants }, { data: owners }] = await Promise.all([
    db().from("merchants").select("*").eq("status", "active").order("name"),
    ownerQuery,
  ]);
  const canAdd = can(cu, "notifications", "add");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">App Notification</h1>
        <p className="mt-1 text-sm text-muted">
          Push a message to owners&apos; phones. Everything you send is kept below as history.
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
          <input type="hidden" name="country_id" value={active?.id ?? ""} />
          <h2 className="text-sm font-semibold">Send notification</h2>
          <div className="grid gap-3 sm:grid-cols-2">
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

    </div>
  );
}

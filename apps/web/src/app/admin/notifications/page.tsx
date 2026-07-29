import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { NotificationComposer, type ComposerOwner } from "@/modules/notifications/components/composer";
import { ErrorBanner } from "@/components/error-banner";
import { requireCountryScope } from "@/modules/countries/lib";

// Compose an app notification: white label first, then everyone in it or a
// hand-picked list of owners.
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { cu } = await requirePerm("notifications", "view");
  const { error, sent } = await searchParams;
  const { active } = await requireCountryScope();

  let ownerQuery = db()
    .from("owners")
    .select("id, ref, full_name, merchant_id")
    .neq("status", "banned")
    .order("full_name");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);

  const [{ data: merchants }, { data: owners }] = await Promise.all([
    db().from("merchants").select("id, name, merchant_countries(country_id)").eq("status", "active").order("name"),
    ownerQuery,
  ]);

  const merchantList = ((merchants ?? []) as unknown as {
    id: string;
    name: string;
    merchant_countries: { country_id: string }[];
  }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ id: m.id, name: m.name }));

  const ownerList: ComposerOwner[] = ((owners ?? []) as {
    id: string; ref: string | null; full_name: string | null; merchant_id: string;
  }[]).map((o) => ({
    id: o.id,
    ref: o.ref,
    name: o.full_name || "(no name)",
    merchantId: o.merchant_id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">App Notification</h1>
        <p className="mt-1 text-sm text-muted">
          Push a message to owners&apos; phones{active ? ` in ${active.name}` : ""}. Everything you send is kept in
          Notification History.
        </p>
      </div>
      <ErrorBanner message={error} />
      {sent && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sent to {sent} owner{sent === "1" ? "" : "s"}.
        </p>
      )}

      {can(cu, "notifications", "add") && (
        <NotificationComposer merchants={merchantList} owners={ownerList} countryId={active?.id ?? ""} />
      )}
    </div>
  );
}

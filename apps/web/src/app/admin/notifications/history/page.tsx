import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { deleteNotification } from "@/modules/notifications/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, TableToolbar } from "@/components/data-table";
import { Pagination, pageParams } from "@/components/pagination";
import { requireCountryScope } from "@/modules/countries/lib";
import { type AppNotification } from "@/lib/types";

// Everything ever pushed to owners' phones, filterable by white label.
export default async function NotificationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; merchant?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("notifications", "view");
  const sp = await searchParams;
  const { error, sent, merchant = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();

  let ownerQuery = db().from("owners").select("id, merchant_id");
  if (active) ownerQuery = ownerQuery.eq("country_id", active.id);
  if (merchant) ownerQuery = ownerQuery.eq("merchant_id", merchant);

  const [{ data: owners }, { data: merchants }] = await Promise.all([
    ownerQuery,
    db().from("merchants").select("id, name, merchant_countries(country_id)").order("name"),
  ]);
  const ownerIds = ((owners ?? []) as { id: string }[]).map((o) => o.id);

  const { data: rows, count } = ownerIds.length
    ? await db()
        .from("notifications")
        .select("*, owner:owners(full_name, merchant_id)", { count: "exact" })
        .in("owner_id", ownerIds)
        .order("created_at", { ascending: false })
        .range(from, to)
    : { data: [], count: 0 };
  const list = (rows ?? []) as (AppNotification & { owner: { full_name: string | null } | null })[];
  const total = count ?? list.length;

  const merchantOptions = ((merchants ?? []) as unknown as {
    id: string;
    name: string;
    merchant_countries: { country_id: string }[];
  }[])
    .filter((m) => !active || m.merchant_countries.some((c) => c.country_id === active.id))
    .map((m) => ({ value: m.id, label: m.name }));

  const canDelete = can(cu, "notifications", "delete");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/notifications" className="text-xs text-muted hover:text-foreground">← App Notification</Link>
        <h1 className="mt-1 text-xl font-semibold">Notification History</h1>
        <p className="mt-1 text-sm text-muted">Everything sent to owners&apos; phones, newest first.</p>
      </div>
      <ErrorBanner message={error} />
      {sent && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sent to {sent} owner{sent === "1" ? "" : "s"}.
        </p>
      )}

      <TableToolbar count={total} noun="notification">
        <FilterForm action="/admin/notifications/history">
          <FilterSelect
            label="White Label"
            name="merchant"
            value={merchant}
            options={[{ value: "", label: "All white labels" }, ...merchantOptions]}
          />
        </FilterForm>
      </TableToolbar>

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

      <Pagination
        basePath="/admin/notifications/history"
        params={{ merchant }}
        page={page}
        perPage={perPage}
        total={total}
      />
    </div>
  );
}

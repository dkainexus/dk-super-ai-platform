import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { couriersFor } from "@/modules/shipping/lib";
import { saveCourier, toggleCourier } from "@/modules/shipping/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { ActiveTag } from "@/components/status-tag";

// The couriers we ship with, per country. The tracking link template turns
// every tracking number in the system into a live link — {tracking} marks
// where the number goes.
export default async function CouriersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("shipping", "view");
  const { error, saved } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const couriers = await couriersFor(active.id, false);
  const canEdit = Boolean(can(cu, "shipping", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/shipping" className="text-xs text-muted hover:text-foreground">← Shipping</Link>
        <h1 className="mt-1 text-xl font-semibold">Couriers — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Shipments pick from this list, and the tracking link makes every tracking number clickable — for the
          customer and for us. Put <span className="mono-num">{"{tracking}"}</span> where the number belongs.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      <section className="card divide-y divide-border p-5">
        {couriers.length === 0 && <p className="pb-4 text-sm text-muted">No couriers yet — add the first below.</p>}
        {couriers.map((c) => (
          <div key={c.id} className="flex flex-wrap items-end gap-2 py-3">
            {canEdit ? (
              <form action={saveCourier} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="country_id" value={active.id} />
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
                  <input name="name" defaultValue={c.name} className="input w-40 py-1.5 text-sm" required />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Tracking link template</label>
                  <input
                    name="url_template"
                    defaultValue={c.url_template ?? ""}
                    className="input mono-num py-1.5 text-xs"
                    placeholder="https://…/track?no={tracking}"
                    required
                  />
                </div>
                <ActionButton icon="save" tip="Save this courier" label="Save" variant="outline" />
              </form>
            ) : (
              <div className="flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="mono-num text-xs text-muted">{c.url_template ?? "no link"}</p>
              </div>
            )}
            <div className="flex items-center gap-2 pb-1">
              <ActiveTag active={c.active} on="Active" off="Off" />
              {canEdit && (
                <form action={toggleCourier}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                  <ActionButton
                    icon="power"
                    tip={c.active ? "Hide from the courier picker" : "Show in the courier picker"}
                    variant="outline"
                  />
                </form>
              )}
            </div>
          </div>
        ))}

        {canEdit && (
          <form action={saveCourier} className="flex flex-wrap items-end gap-2 pt-4">
            <input type="hidden" name="country_id" value={active.id} />
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Name</label>
              <input name="name" className="input w-40 py-1.5 text-sm" placeholder="Kerry Express" required />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Tracking link template</label>
              <input
                name="url_template"
                className="input mono-num py-1.5 text-xs"
                placeholder="https://th.kerryexpress.com/track/?track={tracking}"
                required
              />
            </div>
            <ActionButton icon="plus" tip="Add this courier" label="Add" variant="primary" />
          </form>
        )}
      </section>
    </div>
  );
}

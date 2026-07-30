import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { shipmentsFor, shipmentStage, couriersFor, trackingUrl } from "@/modules/shipping/lib";
import { markShipped, updateTracking } from "@/modules/shipping/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";

const STAGE_STYLE: Record<string, string> = {
  to_ship: "border-warning/40 bg-warning/10 text-warning",
  in_transit: "border-accent/40 bg-accent-soft text-accent-strong",
  received: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};
const STAGE_LABEL: Record<string, string> = {
  to_ship: "to ship",
  in_transit: "in transit",
  received: "delivered",
  cancelled: "cancelled",
};

// Everything that leaves the building, in one queue: pack it, ship it with a
// tracking number, and wait for the customer to confirm it arrived. Billing
// is not this module's business — that starts when the customer accepts the
// account (or on day 14).
export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; stage?: string }>;
}) {
  const { cu } = await requirePerm("shipping", "view");
  const { error, saved, stage = "" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const [rows, couriers] = await Promise.all([
    shipmentsFor({ countryId: active.id, stage: stage || undefined }),
    couriersFor(active.id),
  ]);
  const canEdit = Boolean(can(cu, "shipping", "edit"));
  const back = "/admin/shipping";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shipping — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Everything to send and everything in transit. The customer confirms arrival in their portal, then
          accepts the account themselves — nothing here touches billing.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "shipped" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Marked shipped — the customer sees the courier and tracking number in their portal.
        </p>
      )}

      <TableToolbar count={rows.length} noun="shipment">
        <FilterForm action={back}>
          <FilterSelect
            label="Stage"
            name="stage"
            value={stage}
            options={[
              { value: "", label: "All" },
              { value: "to_ship", label: "To ship" },
              { value: "in_transit", label: "In transit" },
              { value: "received", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <div className="card divide-y divide-border p-0">
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nothing here.</p>}
        {rows.map((s) => {
          const st = shipmentStage(s);
          const url = trackingUrl(s.courier_rec?.url_template, s.tracking_no);
          return (
            <div key={s.id} className="flex flex-nowrap items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.customer?.name ?? "?"}
                  <span className="mono-num ml-2 text-[11px] font-normal text-muted">{s.ref ?? ""}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {s.address.name} · {s.address.phone} · {s.address.address}
                </p>
                <p className="mono-num truncate text-[11px] text-muted">
                  {s.assignment?.bank_account?.bank?.name ?? "?"} {s.assignment?.bank_account?.account_no ?? ""} ·{" "}
                  {s.assignment?.ref ?? ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
                {s.shipped_at && (
                  <span className="text-[11px] text-muted">
                    shipped {s.shipped_at.slice(0, 10)}
                    {s.received_at ? ` · received ${s.received_at.slice(0, 10)}` : ""}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2">
                {st === "to_ship" && canEdit ? (
                  <form action={markShipped} className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="courier_id" className="input w-auto" required>
                      <option value="">— Courier —</option>
                      {couriers.map((co) => (
                        <option key={co.id} value={co.id}>{co.name}</option>
                      ))}
                    </select>
                    <input name="tracking_no" className="input mono-num w-44" placeholder="Tracking no." />
                    <ActionButton icon="send" tip="The parcel left — the customer sees the tracking number" label="Shipped" variant="primary" />
                  </form>
                ) : st === "in_transit" && canEdit ? (
                  <form action={updateTracking} className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="courier_id" defaultValue={s.courier_id ?? ""} className="input w-auto" required>
                      <option value="">— Courier —</option>
                      {couriers.map((co) => (
                        <option key={co.id} value={co.id}>{co.name}</option>
                      ))}
                    </select>
                    <input name="tracking_no" defaultValue={s.tracking_no ?? ""} className="input mono-num w-44" />
                    <ActionButton icon="save" tip="Fix the courier or tracking number" variant="outline" />
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent-strong hover:underline">
                        Track ↗
                      </a>
                    )}
                  </form>
                ) : (
                  s.tracking_no && (
                    <span className="mono-num text-xs text-muted">
                      {s.courier} ·{" "}
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">
                          {s.tracking_no} ↗
                        </a>
                      ) : (
                        s.tracking_no
                      )}
                    </span>
                  )
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

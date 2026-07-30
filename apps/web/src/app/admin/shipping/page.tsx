import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { shipmentsFor, shipmentStage, couriersFor, trackingUrl } from "@/modules/shipping/lib";
import { markShipped, updateTracking } from "@/modules/shipping/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
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
  received: "received",
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

      <Table head={["Customer", "Courier / Tracking", "Stage"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="px-4 py-6 text-sm text-muted">Nothing here.</td>
          </tr>
        )}
        {rows.map((s) => {
          const st = shipmentStage(s);
          return (
            <tr key={s.id} className="align-top transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5 text-sm">
                {s.customer?.name ?? "?"}
                <span className="mono-num block text-[11px] text-muted">{s.ref ?? ""}</span>
                <details className="mt-0.5 text-xs text-muted">
                  <summary className="cursor-pointer hover:text-foreground">details</summary>
                  <p className="mt-1">
                    {s.address.name} · {s.address.phone}
                    <span className="block">{s.address.address}</span>
                    <span className="mono-num block">
                      {s.assignment?.bank_account?.bank?.name ?? "?"} {s.assignment?.bank_account?.account_no ?? ""} ·{" "}
                      {s.assignment?.ref ?? ""}
                    </span>
                  </p>
                </details>
              </td>
              <td className="px-4 py-2.5">
                {st === "to_ship" && canEdit ? (
                  <form action={markShipped} className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="courier_id" className="input w-auto px-2 py-1 text-xs" required>
                      <option value="">— Courier —</option>
                      {couriers.map((co) => (
                        <option key={co.id} value={co.id}>{co.name}</option>
                      ))}
                    </select>
                    <input name="tracking_no" className="input mono-num w-36 px-2 py-1 text-xs" placeholder="Tracking no." />
                    <ActionButton icon="send" tip="The parcel left — the customer sees the tracking number" label="Shipped" variant="primary" />
                  </form>
                ) : st === "in_transit" && canEdit ? (
                  <form action={updateTracking} className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="courier_id" defaultValue={s.courier_id ?? ""} className="input w-auto px-2 py-1 text-xs" required>
                      <option value="">— Courier —</option>
                      {couriers.map((co) => (
                        <option key={co.id} value={co.id}>{co.name}</option>
                      ))}
                    </select>
                    <input name="tracking_no" defaultValue={s.tracking_no ?? ""} className="input mono-num w-36 px-2 py-1 text-xs" />
                    <ActionButton icon="save" tip="Fix the courier or tracking number" variant="outline" />
                  </form>
                ) : (
                  <span className="mono-num text-xs text-muted">
                    {s.courier ? `${s.courier} · ` : "—"}
                    {s.tracking_no &&
                      (trackingUrl(s.courier_rec?.url_template, s.tracking_no) ? (
                        <a
                          href={trackingUrl(s.courier_rec?.url_template, s.tracking_no)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-strong hover:underline"
                        >
                          {s.tracking_no}
                        </a>
                      ) : (
                        s.tracking_no
                      ))}
                  </span>
                )}
                {s.shipped_at && (
                  <p className="mt-1 text-[11px] text-muted">
                    shipped {s.shipped_at.slice(0, 10)}
                    {s.received_at ? ` · received ${s.received_at.slice(0, 10)}` : ""}
                    {trackingUrl(s.courier_rec?.url_template, s.tracking_no) && (
                      <a
                        href={trackingUrl(s.courier_rec?.url_template, s.tracking_no)!}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-accent-strong hover:underline"
                      >
                        Track ↗
                      </a>
                    )}
                  </p>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

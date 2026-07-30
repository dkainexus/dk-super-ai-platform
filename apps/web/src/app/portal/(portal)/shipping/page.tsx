import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { shipmentStage, type ShipmentRow, SHIPMENT_SELECT } from "@/modules/shipping/lib";
import { liveTracking, trackingApiKey, type TrackResult } from "@/modules/shipping/track17";
import { confirmReceived } from "@/app/portal/actions";
import { ErrorBanner } from "@/components/error-banner";

const STAGE_STYLE: Record<string, string> = {
  to_ship: "border-warning/40 bg-warning/10 text-warning",
  in_transit: "border-accent/40 bg-accent-soft text-accent-strong",
  received: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};
const STAGE_LABEL: Record<string, string> = {
  to_ship: "preparing",
  in_transit: "in transit",
  received: "received",
  cancelled: "cancelled",
};

// The customer's shipments, tracked inside our own page — no jumping to
// courier sites. Live events appear when the tracking API is configured;
// our own milestones always show.
export default async function PortalShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error, saved } = await searchParams;

  const { data } = await db()
    .from("shipments")
    .select(SHIPMENT_SELECT)
    .eq("customer_id", c.id)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as ShipmentRow[];
  const hasApi = Boolean(await trackingApiKey());

  const live = new Map<string, TrackResult | null>();
  for (const s of rows) {
    if (s.shipped_at && !s.received_at && s.tracking_no) {
      live.set(s.id, await liveTracking(s.id, s.tracking_no));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shipping</h1>
        <p className="mt-1 text-sm text-muted">
          Everything we are sending you, tracked right here. Press &quot;I&apos;ve received it&quot; when a
          parcel arrives, then test the account on My Agreements.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "received" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Noted — now try the account, and press Account Tested on My Agreements once it works.
        </p>
      )}

      {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">Nothing being shipped right now.</p>}

      {rows.map((s) => {
        const st = shipmentStage(s);
        const tracking = live.get(s.id);
        return (
          <section key={s.id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {s.assignment?.bank_account?.bank?.name ?? "Shipment"}{" "}
                  <span className="mono-num font-normal text-muted">{s.assignment?.bank_account?.account_no ?? ""}</span>
                </p>
                <p className="mono-num text-xs text-muted">
                  {s.ref ?? ""} · to {s.address.name}, {s.address.address}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
            </div>

            {/* Our own milestones — always there. */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <span>Prepared {s.created_at.slice(0, 10)}</span>
              {s.shipped_at && (
                <span>
                  Shipped {s.shipped_at.slice(0, 10)} — <span className="mono-num">{s.courier} · {s.tracking_no}</span>
                </span>
              )}
              {s.received_at && <span className="text-success">Received {s.received_at.slice(0, 10)}</span>}
            </div>

            {/* Live courier events, in-page. */}
            {s.shipped_at && !s.received_at && (
              <div className="rounded-lg border border-border p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Where is it now</p>
                {!hasApi && (
                  <p className="text-sm text-muted">
                    Your parcel is on its way with {s.courier}. Tracking number:{" "}
                    <span className="mono-num">{s.tracking_no}</span>.
                  </p>
                )}
                {hasApi && tracking && tracking.events.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {tracking.events.map((e, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="mono-num shrink-0 text-xs text-muted">
                          {e.time ? e.time.slice(0, 16).replace("T", " ") : ""}
                        </span>
                        <span className={i === 0 ? "" : "text-muted"}>
                          {e.description}
                          {e.location ? <span className="text-muted"> — {e.location}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {hasApi && tracking && tracking.events.length === 0 && (
                  <p className="text-sm text-muted">{tracking.error ?? "No tracking events yet."}</p>
                )}
                {hasApi && !tracking && (
                  <p className="text-sm text-muted">Tracking is temporarily unavailable — try again shortly.</p>
                )}
              </div>
            )}

            {s.shipped_at && !s.received_at && (
              <form action={confirmReceived}>
                <input type="hidden" name="id" value={s.assignment_id ?? ""} />
                <input type="hidden" name="back" value="/portal/shipping" />
                <button className="rounded-md border border-accent/50 px-3 py-1.5 text-sm text-accent-strong hover:bg-accent-soft">
                  I&apos;ve received it
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}

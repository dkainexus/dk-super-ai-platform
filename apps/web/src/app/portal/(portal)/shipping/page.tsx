import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { shipmentStage, type ShipmentRow, SHIPMENT_SELECT } from "@/modules/shipping/lib";
import { liveTracking, trackingApiKey, type TrackResult } from "@/modules/shipping/tracking";
import { confirmReceived } from "@/app/portal/actions";
import { ErrorBanner } from "@/components/error-banner";
import { Table, TableToolbar } from "@/components/data-table";

const STAGE_STYLE: Record<string, string> = {
  to_ship: "border-warning/40 bg-warning/10 text-warning",
  in_transit: "border-accent/40 bg-accent-soft text-accent-strong",
  received: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};
const STAGE_LABEL: Record<string, string> = {
  to_ship: "preparing",
  in_transit: "in transit",
  received: "delivered",
  cancelled: "cancelled",
};

// The customer's shipments as a tidy list. The eye opens the live journey in
// an overlay; a parcel the courier reports delivered flips its own status.
export default async function PortalShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; view?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error, saved, view } = await searchParams;

  const { data } = await db()
    .from("shipments")
    .select(SHIPMENT_SELECT)
    .eq("customer_id", c.id)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });
  let rows = (data ?? []) as unknown as ShipmentRow[];
  const hasApi = Boolean(await trackingApiKey());

  // Refresh in-transit parcels (cached 30 min) — delivered ones flip here.
  const live = new Map<string, TrackResult | null>();
  for (const s of rows) {
    if (s.shipped_at && !s.received_at && s.tracking_no) {
      live.set(s.id, await liveTracking(s.id, s.tracking_no));
    }
  }
  // A parcel the courier just reported delivered flips right now, in hand —
  // no re-read, no race with the write that liveTracking made.
  for (const s of rows) {
    const t = live.get(s.id);
    if (t && (t.status ?? "").toLowerCase().includes("delivered") && !s.received_at) {
      s.received_at = t.fetched_at;
    }
  }

  const viewing = view ? rows.find((s) => s.id === view) ?? null : null;
  const viewingTrack: TrackResult | null = viewing
    ? ((viewing.track_cache as TrackResult | null) ??
      (viewing.tracking_no ? await liveTracking(viewing.id, viewing.tracking_no) : null))
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shipping</h1>
        <p className="mt-1 text-sm text-muted">
          Everything we are sending you. A delivered parcel updates itself — then test the account on My
          Agreements.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "received" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Noted — now try the account, and press Account Tested on My Agreements once it works.
        </p>
      )}

      <TableToolbar count={rows.length} noun="shipment" />
      <Table head={["Account", "Courier / Tracking", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-6 text-sm text-muted">Nothing being shipped right now.</td>
          </tr>
        )}
        {rows.map((s) => {
          const st = shipmentStage(s);
          return (
            <tr key={s.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5">
                <p className="text-sm font-medium">
                  {s.assignment?.bank_account?.bank?.name ?? "Shipment"}{" "}
                  <span className="mono-num font-normal text-muted">{s.assignment?.bank_account?.account_no ?? ""}</span>
                </p>
                <p className="mono-num text-[11px] text-muted">{s.ref ?? ""}</p>
              </td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {s.tracking_no ? `${s.courier} · ${s.tracking_no}` : "—"}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-2">
                  {s.shipped_at && !s.received_at && (
                    <form action={confirmReceived}>
                      <input type="hidden" name="id" value={s.assignment_id ?? ""} />
                      <input type="hidden" name="back" value="/portal/shipping" />
                      <button className="whitespace-nowrap rounded-md border border-accent/50 px-2.5 py-1 text-xs text-accent-strong hover:bg-accent-soft">
                        I&apos;ve received it
                      </button>
                    </form>
                  )}
                  {s.shipped_at && (
                    <Link
                      href={`/portal/shipping?view=${s.id}`}
                      title="See the parcel's journey"
                      className="rounded-md border border-border p-1.5 text-muted transition-colors hover:border-accent hover:text-foreground"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Link href="/portal/shipping" aria-label="Close" className="absolute inset-0 bg-black/70" />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-sm font-semibold">
                  {viewing.assignment?.bank_account?.bank?.name ?? "Shipment"}{" "}
                  <span className="mono-num font-normal text-muted">
                    {viewing.assignment?.bank_account?.account_no ?? ""}
                  </span>
                </p>
                <p className="mono-num mt-0.5 text-xs text-muted">
                  {viewing.courier} · {viewing.tracking_no}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${STAGE_STYLE[shipmentStage(viewing)]}`}
              >
                {STAGE_LABEL[shipmentStage(viewing)]}
              </span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {viewingTrack && viewingTrack.events.length > 0 ? (
                <ol className="relative ml-2 border-l border-border">
                  {viewingTrack.events.map((e, i) => (
                    <li key={i} className="relative pb-4 pl-5 last:pb-0">
                      <span
                        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${
                          i === 0 ? "bg-accent shadow-[0_0_8px_var(--accent)]" : "bg-border"
                        }`}
                      />
                      <p className={`text-sm ${i === 0 ? "" : "text-muted"}`}>
                        {e.description}
                        {e.location ? <span className="text-muted"> — {e.location}</span> : null}
                      </p>
                      <p className="mono-num text-[11px] text-muted">
                        {e.time ? e.time.slice(0, 16).replace("T", " ") : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  {hasApi
                    ? viewingTrack?.error ?? "No tracking events yet — check back soon."
                    : `Your parcel is on its way with ${viewing.courier}.`}
                </p>
              )}
            </div>

            <div className="border-t border-border px-5 py-3 text-right">
              <Link
                href="/portal/shipping"
                className="inline-block rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                Close
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

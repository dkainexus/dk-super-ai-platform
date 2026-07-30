import "server-only";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

// Live tracking through the TrackingMore API, shown inside our own pages.
// Without an API key the portal falls back to our own milestones — nothing
// breaks. Key setup: trackingmore.com → API key → Platform Settings →
// Shipping Tracking.

export type TrackEvent = { time: string; description: string; location: string | null };
export type TrackResult = {
  status: string | null;
  events: TrackEvent[];
  fetched_at: string;
  error?: string;
};

const API = "https://api.trackingmore.com/v4";
const CACHE_MINUTES = 30;

export async function trackingApiKey(): Promise<string | null> {
  const cfg = await getSetting<{ trackingmore_key?: string }>("shipping", {});
  return cfg.trackingmore_key?.trim() || null;
}

async function call(
  key: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "Tracking-Api-Key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type TmTracking = {
  tracking_number: string;
  delivery_status?: string;
  origin_info?: {
    trackinfo?: { checkpoint_date?: string; tracking_detail?: string; location?: string }[];
  };
};

/**
 * Live events for a shipment, cached for 30 minutes. Detects the courier and
 * registers the number on first sight (TrackingMore requires it), then reads
 * the checkpoints. Returns null when no API key is configured.
 */
export async function liveTracking(shipmentId: string, trackingNo: string): Promise<TrackResult | null> {
  const key = await trackingApiKey();
  if (!key) return null;

  const { data: cached } = await db()
    .from("shipments")
    .select("track_cache, track_cached_at")
    .eq("id", shipmentId)
    .maybeSingle();
  if (cached?.track_cache && cached.track_cached_at) {
    const age = Date.now() - new Date(cached.track_cached_at as string).getTime();
    if (age < CACHE_MINUTES * 60_000) return cached.track_cache as TrackResult;
  }

  let info = await call(key, "GET", `/trackings/get?tracking_numbers=${encodeURIComponent(trackingNo)}`);
  let items = (info?.data as TmTracking[] | null) ?? [];

  // Not registered yet: detect the courier, create the tracking, read again.
  if (items.length === 0) {
    const detect = await call(key, "POST", "/couriers/detect", { tracking_number: trackingNo });
    const courierCode = ((detect?.data as { courier_code?: string }[] | null) ?? [])[0]?.courier_code;
    if (courierCode) {
      await call(key, "POST", "/trackings/create", { tracking_number: trackingNo, courier_code: courierCode });
      info = await call(key, "GET", `/trackings/get?tracking_numbers=${encodeURIComponent(trackingNo)}`);
      items = (info?.data as TmTracking[] | null) ?? [];
    }
  }

  const hit = items.find((t) => t.tracking_number === trackingNo) ?? items[0];
  let result: TrackResult;
  const raw = hit?.origin_info?.trackinfo ?? [];
  if (!hit || raw.length === 0) {
    result = {
      status: hit?.delivery_status ?? null,
      events: [],
      fetched_at: new Date().toISOString(),
      error: "No tracking data yet — couriers can take a few hours to report the first scan",
    };
  } else {
    const events = raw
      .map((e) => ({
        time: e.checkpoint_date ?? "",
        description: e.tracking_detail ?? "",
        location: e.location || null,
      }))
      .sort((a, b) => (a.time < b.time ? 1 : -1));
    result = { status: hit.delivery_status ?? null, events, fetched_at: new Date().toISOString() };
  }

  const patch: Record<string, unknown> = { track_cache: result, track_cached_at: result.fetched_at };
  // The courier's word is enough: a delivered parcel marks itself received,
  // no button required. The customer can still confirm manually as fallback.
  if ((result.status ?? "").toLowerCase().includes("delivered")) {
    const { data: row } = await db().from("shipments").select("received_at").eq("id", shipmentId).maybeSingle();
    if (row && !row.received_at) patch.received_at = result.fetched_at;
  }
  await db().from("shipments").update(patch).eq("id", shipmentId);
  return result;
}

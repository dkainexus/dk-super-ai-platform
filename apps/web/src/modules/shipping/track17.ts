import "server-only";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";

// Live tracking through the 17TRACK API, shown inside our own pages. Without
// an API key the portal falls back to our own milestones — nothing breaks.
// Key setup: register at 17track.net, paste the token under Platform
// Settings → Shipping Tracking.

export type TrackEvent = { time: string; description: string; location: string | null };
export type TrackResult = {
  status: string | null;
  events: TrackEvent[];
  fetched_at: string;
  error?: string;
};

const API = "https://api.17track.net/track/v2.2";
const CACHE_MINUTES = 30;

export async function trackingApiKey(): Promise<string | null> {
  const cfg = await getSetting<{ track17_key?: string }>("shipping", {});
  return cfg.track17_key?.trim() || null;
}

async function call(key: string, path: string, body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "17token": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Live events for a shipment, cached for 30 minutes. Registers the number on
 * first sight (17TRACK requires it), then reads the track info. Returns null
 * when no API key is configured.
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

  // Register is idempotent enough: "already registered" is a success for us.
  await call(key, "/register", [{ number: trackingNo }]);
  const info = await call(key, "/gettrackinfo", [{ number: trackingNo }]);

  let result: TrackResult;
  const accepted = (info?.data as { accepted?: unknown[] } | undefined)?.accepted as
    | {
        number: string;
        track_info?: {
          latest_status?: { status?: string };
          tracking?: { providers?: { events?: { time_iso?: string; description?: string; location?: string }[] }[] };
        };
      }[]
    | undefined;
  const hit = accepted?.find((a) => a.number === trackingNo) ?? accepted?.[0];
  if (!hit?.track_info) {
    result = {
      status: null,
      events: [],
      fetched_at: new Date().toISOString(),
      error: "No tracking data yet — couriers can take a few hours to report the first scan",
    };
  } else {
    const events = (hit.track_info.tracking?.providers ?? [])
      .flatMap((p) => p.events ?? [])
      .map((e) => ({
        time: e.time_iso ?? "",
        description: e.description ?? "",
        location: e.location || null,
      }))
      .sort((a, b) => (a.time < b.time ? 1 : -1));
    result = {
      status: hit.track_info.latest_status?.status ?? null,
      events,
      fetched_at: new Date().toISOString(),
    };
  }

  await db()
    .from("shipments")
    .update({ track_cache: result, track_cached_at: result.fetched_at })
    .eq("id", shipmentId);
  return result;
}

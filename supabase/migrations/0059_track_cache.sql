-- Live tracking events from the 17TRACK API, cached on the shipment so the
-- portal doesn't hammer the quota. Empty when no API key is configured.
alter table shipments add column if not exists track_cache jsonb;
alter table shipments add column if not exists track_cached_at timestamptz;

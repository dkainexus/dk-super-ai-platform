-- Couriers are managed data, per country: a name and the official tracking
-- page with {tracking} as the placeholder. Shipments point at a courier, and
-- the tracking number becomes a live link everywhere it is shown.
create table if not exists couriers (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  url_template text,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
alter table couriers enable row level security;

alter table shipments add column if not exists courier_id uuid references couriers(id) on delete set null;

-- Per-user country assignment inside a white label. No rows = the user can
-- access all of the white label's countries (default).
create table user_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, country_id)
);

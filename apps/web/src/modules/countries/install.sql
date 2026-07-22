-- Countries (core): the workspace container. Every white label belongs to
-- one country and inherits its timezone and currency.

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- ISO 3166-1 alpha-2, e.g. TH
  name text not null,
  flag text,                          -- emoji
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now()
);

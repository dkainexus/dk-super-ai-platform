-- Merchants (core) — displayed as "White Label". Each row is one branded
-- tenant: own name, logo, subdomain / custom domain, module opt-outs.

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  subdomain text unique,
  custom_domain text unique,
  status text not null default 'active' check (status in ('active','suspended')),
  disabled_modules jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Countries a white label operates in (no primary country — records pick
-- their country at creation time).
create table if not exists merchant_countries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  created_at timestamptz not null default now(),
  unique (merchant_id, country_id)
);

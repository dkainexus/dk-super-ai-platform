-- DK CMS — countries / merchants / owners with per-country custom fields
-- Web CMS layer on top of the bot platform. Authorization is app-level
-- (service-role client), same as the rest of the schema.

create table countries (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,             -- ISO 3166-1 alpha-2, e.g. 'TH'
  name text not null,
  flag text,                             -- emoji
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table merchants (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete restrict,
  name text not null,                    -- brand name, merchant-editable
  logo_path text,                        -- storage path in cms-assets bucket
  subdomain text unique,                 -- merchant-editable slug for tenant routing
  custom_domain text unique,             -- phase 2: merchant-bound custom domain
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table merchant_users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  username text unique not null,
  password_hash text not null,
  name text,
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Per-country custom owner fields, defined by superadmin. The built-in
-- fields (full name, id number, id front/back photos) live on owners
-- directly; everything country-specific (e.g. TH tabien baan) goes here.
create table country_fields (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  field_key text not null,               -- slug, stable identifier
  label text not null,
  field_type text not null check (field_type in ('text','number','date','file','select')),
  options jsonb not null default '[]',   -- select choices
  required boolean not null default false,
  sort int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, field_key)
);

create table owners (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  full_name text,
  id_number text,
  id_front_path text,                    -- storage paths in owner-docs bucket
  id_back_path text,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references staff(id),
  reviewed_at timestamptz,
  -- Telegram intake: merchant generates a one-time invite deep link; the
  -- onboarding bot binds the chat to this row and fills in the data.
  telegram_user_id bigint,
  invite_token text unique,
  invite_expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index owners_merchant_idx on owners (merchant_id, status);
create index owners_country_idx on owners (country_id, status);

create table owner_field_values (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  field_id uuid not null references country_fields(id) on delete cascade,
  value_text text,                       -- text/number/date/select values
  file_path text,                        -- file values: storage path
  updated_at timestamptz not null default now(),
  unique (owner_id, field_id)
);

-- Storage buckets (private; files served through signed URLs from the web app)
insert into storage.buckets (id, name, public)
values ('cms-assets', 'cms-assets', false), ('owner-docs', 'owner-docs', false)
on conflict (id) do nothing;

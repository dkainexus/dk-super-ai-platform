-- Owners module install (owner records + per-country custom fields + occupations)
-- Requires core tables: countries, merchants, users, roles, app_config.
-- Storage: private bucket 'owner-docs' for ID photos and file fields.

create table if not exists country_fields (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('text','number','date','file','select')),
  options jsonb not null default '[]',
  required boolean not null default false,
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, field_key)
);

create table if not exists occupations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  company_type text,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  full_name text,
  id_number text,
  gender text check (gender in ('male','female','other')),
  marital_status text check (marital_status in ('single','married','divorced','widowed')),
  phone text,
  email text,
  id_front_path text,
  id_back_path text,
  photo_full_body_path text,
  bank_id uuid references banks(id),          -- optional; requires Banks module
  bank_account_no text,
  occupation_id uuid references occupations(id),
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  telegram_user_id bigint,
  invite_token text unique,
  invite_expires_at timestamptz,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists owner_field_values (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  field_id uuid not null references country_fields(id) on delete cascade,
  value_text text,
  file_path text,
  updated_at timestamptz not null default now(),
  unique (owner_id, field_id)
);

-- Register permissions for system roles + enable the module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'owners', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"owners": true}'::jsonb where key = 'modules';

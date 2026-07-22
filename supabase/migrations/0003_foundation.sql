-- Foundation: unified users, RBAC (module x action x scope), module toggles.
--
-- Design (template-grade, reusable across white-label platforms):
--   users        one table for everyone; merchant_id null = platform user
--   roles        level 'platform' | 'merchant'; merchant_id set = merchant-created
--   role_permissions  module x action(view/add/edit/delete) x scope(own/merchant/all)
--   app_config   reused as the settings store (key 'modules' = global toggles)
--   merchants.disabled_modules  per-merchant module opt-out
--
-- Old `staff` stays untouched (Telegram bots use it). CMS rows are migrated
-- into `users` PRESERVING ids so existing session cookies keep working.

create table roles (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform','merchant')),
  merchant_id uuid references merchants(id) on delete cascade, -- null = shared/system
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  module text not null,
  action text not null check (action in ('view','add','edit','delete')),
  scope text not null check (scope in ('own','merchant','all')),
  unique (role_id, module, action)
);

create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text,
  password_hash text not null,
  name text,
  avatar_path text,
  merchant_id uuid references merchants(id) on delete cascade, -- null = platform side
  role_id uuid references roles(id) on delete set null,
  is_superadmin boolean not null default false,
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_merchant_idx on users (merchant_id);

alter table merchants add column disabled_modules jsonb not null default '[]';

-- Owners keep track of who created them (for the 'own' permission scope).
alter table owners add column created_by uuid references users(id);

-- ---------- Seed system roles ----------

insert into roles (level, name, description, is_system) values
  ('platform', 'Platform Admin', 'Full access to everything on the platform side', true),
  ('merchant', 'Merchant Owner', 'Full access to everything inside the merchant', true);

insert into role_permissions (role_id, module, action, scope)
select r.id, m.module, a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('owners'),('merchants'),('countries'),('users'),('roles'),('settings')) as m(module)
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system;

-- ---------- Migrate existing accounts (ids preserved) ----------

-- CMS staff logins -> platform users (superadmin). Bots keep reading `staff`.
insert into users (id, username, email, password_hash, name, merchant_id, role_id, is_superadmin, must_change_password, active)
select s.id, s.username, null, s.password_hash, s.name, null,
       (select id from roles where name = 'Platform Admin'),
       true, s.must_change_password, s.active
from staff s
where s.username is not null and s.password_hash is not null
on conflict (username) do nothing;

-- Merchant logins -> merchant users with the Merchant Owner role.
insert into users (id, username, email, password_hash, name, merchant_id, role_id, is_superadmin, must_change_password, active)
select mu.id, mu.username, null, mu.password_hash, mu.name, mu.merchant_id,
       (select id from roles where name = 'Merchant Owner'),
       false, mu.must_change_password, mu.active
from merchant_users mu
on conflict (username) do nothing;

-- Default module toggles (all on).
insert into app_config (key, value) values
  ('modules', '{"owners": true}'::jsonb),
  ('platform', '{"name": "DK CMS"}'::jsonb)
on conflict (key) do nothing;

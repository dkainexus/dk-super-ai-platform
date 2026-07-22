-- Companies module: companies registered for owners, with optional
-- shareholders (per-country switch lives in app_config key 'companies').
-- Also: owners and companies both gain a 'banned' status.

-- Legacy bot Phase-2 companies table (empty, unreferenced) steps aside,
-- same precedent as banks -> candidate_banks in 0004. If bot Phase 2 is
-- ever built it must use candidate_companies.
alter table companies rename to candidate_companies;

-- Owners: add 'banned' to the status enum
alter table owners drop constraint if exists owners_status_check;
alter table owners add constraint owners_status_check
  check (status in ('draft','pending','approved','rejected','banned'));

create table companies (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  name text not null,
  company_id text,                      -- official registration number
  company_type text,                    -- from the owner's occupation mapping, editable
  business_start_date date,
  -- structured address (separate columns so lists can filter on them)
  address_no text,                      -- house / building number
  street text,
  subdistrict text,
  district text,
  province text,
  postal_code text,
  status text not null default 'preparing'
    check (status in ('preparing','registered','closed','banned')),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Owner bindings: exactly one role per (company, owner). role 'owner' is the
-- company holder; 'shareholder' rows carry a share percentage.
create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  owner_id uuid not null references owners(id),
  role text not null check (role in ('owner','shareholder')),
  share_percent numeric(5,2) check (share_percent > 0 and share_percent <= 100),
  created_at timestamptz not null default now(),
  unique (company_id, owner_id)
);

insert into role_permissions (role_id, module, action, scope)
select r.id, 'companies', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"companies": true}'::jsonb where key = 'modules';

-- Companies module install (companies bound to owners, optional shareholders)
-- Requires core tables + the Owners module. Per-country shareholder switch
-- lives in app_config under key 'companies'.

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  name text not null,
  company_id text,
  company_type text,
  business_start_date date,
  address_no text,
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

create table if not exists company_members (
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

-- Batch 4: theft claims, white-label settlement, expenses.

alter table merchants add column if not exists profit_share_pct numeric not null default 50;
alter table merchants add column if not exists own_use_fee numeric not null default 0;
alter table merchants add column if not exists company_quote numeric not null default 0;
alter table merchants add column if not exists min_prepaid_companies integer not null default 0;

alter table bank_accounts add column if not exists asking_price numeric;
alter table bank_accounts add column if not exists own_use boolean not null default false;

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  amount numeric not null,
  description text,
  status text not null default 'open' check (status in ('open', 'confirmed', 'closed')),
  computation jsonb,
  customer_compensation numeric,
  agent_recovery numeric,
  confirmed_by uuid references users(id) on delete set null,
  confirmed_at timestamptz,
  closed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists claims_ref_uidx on claims(ref) where ref is not null;
alter table claims enable row level security;
drop trigger if exists claims_set_ref on claims;
create trigger claims_set_ref before insert on claims for each row execute function set_ref('claim', 'CLM');

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  merchant_id uuid references merchants(id) on delete set null,
  staff_user_id uuid references users(id) on delete set null,
  device_model_id uuid,
  category text not null,
  amount numeric not null,
  currency text not null default 'THB',
  spent_on date not null,
  note text,
  receipt_path text,
  is_claim boolean not null default false,
  claim_status text check (claim_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_company_idx on expenses(company_id);
alter table expenses enable row level security;

create table if not exists device_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table device_models enable row level security;

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  period_month date not null,
  computation jsonb not null default '{}'::jsonb,
  net_amount numeric not null default 0,
  status text not null default 'approved' check (status in ('approved', 'paid')),
  approved_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (merchant_id, country_id, period_month)
);
alter table settlements enable row level security;

insert into role_permissions (role_id, module, action, scope)
select r.id, m.module, a.action, 'all'
from roles r
cross join (values ('claims'), ('expenses')) as m(module)
cross join (values ('view'), ('add'), ('edit'), ('delete')) as a(action)
where r.is_system and r.level = 'platform'
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"claims": true, "expenses": true}'::jsonb where key = 'modules';

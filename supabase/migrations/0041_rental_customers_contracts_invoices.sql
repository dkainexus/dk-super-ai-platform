-- Batch 1 of the rental system: who rents, on what terms, and what they owe.
-- (Applied via the Supabase MCP; kept here as the source of record.)

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  name text not null,
  company_name text,
  contact_name text,
  email text,
  belongs_to text not null default 'platform' check (belongs_to in ('platform', 'white_label')),
  deposit numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'suspended')),
  notes text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_merchant_idx on customers(merchant_id);
create index if not exists customers_country_idx on customers(country_id);
create unique index if not exists customers_ref_uidx on customers(ref) where ref is not null;
create unique index if not exists customers_user_uidx on customers(user_id) where user_id is not null;
alter table customers enable row level security;
drop trigger if exists customers_set_ref on customers;
create trigger customers_set_ref before insert on customers for each row execute function set_ref('customer', 'CUS');

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  party_type text not null check (party_type in ('customer', 'agent', 'owner')),
  customer_id uuid references customers(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  owner_id uuid references owners(id) on delete cascade,
  min_term_months integer not null default 3,
  renewal_min_months integer not null default 3,
  renewal_window_days integer not null default 30,
  lead_days integer not null default 14,
  deposit numeric not null default 0,
  theft_window_months integer,
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'terminated')),
  notes text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_one_party check (
    (party_type = 'customer' and customer_id is not null and agent_id is null and owner_id is null) or
    (party_type = 'agent'    and agent_id is not null and customer_id is null and owner_id is null) or
    (party_type = 'owner'    and owner_id is not null and customer_id is null and agent_id is null)
  )
);
create index if not exists contracts_party_idx on contracts(party_type, customer_id, agent_id, owner_id);
create index if not exists contracts_country_idx on contracts(country_id);
create unique index if not exists contracts_ref_uidx on contracts(ref) where ref is not null;
alter table contracts enable row level security;
drop trigger if exists contracts_set_ref on contracts;
create trigger contracts_set_ref before insert on contracts for each row execute function set_ref('contract', 'CON');

create table if not exists contract_accounts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  starts_on date,
  ends_on date,
  setup_fee numeric not null default 0,
  setup_fee_invoiced_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (contract_id, bank_account_id)
);
create index if not exists contract_accounts_account_idx on contract_accounts(bank_account_id);
alter table contract_accounts enable row level security;

create table if not exists contract_terms (
  id uuid primary key default gen_random_uuid(),
  contract_account_id uuid not null references contract_accounts(id) on delete cascade,
  base_rent numeric not null default 0,
  turnover_rate numeric,
  effective_from date not null,
  effective_to date,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contract_terms_account_idx on contract_terms(contract_account_id, effective_from);
alter table contract_terms enable row level security;

create table if not exists billing_runs (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  period_month date not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'discarded')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references users(id) on delete set null
);
create unique index if not exists billing_runs_open_uidx
  on billing_runs(country_id, period_month) where status = 'draft';
alter table billing_runs enable row level security;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  run_id uuid references billing_runs(id) on delete cascade,
  direction text not null check (direction in ('receivable', 'payable')),
  party_type text not null check (party_type in ('customer', 'agent', 'owner')),
  customer_id uuid references customers(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  owner_id uuid references owners(id) on delete cascade,
  period_month date not null,
  currency text not null,
  total numeric not null default 0,
  usdt_rate numeric,
  usdt_total numeric,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  issued_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invoices_party_idx on invoices(party_type, customer_id, agent_id, owner_id);
create index if not exists invoices_period_idx on invoices(country_id, period_month);
create unique index if not exists invoices_ref_uidx on invoices(ref) where ref is not null;
alter table invoices enable row level security;
drop trigger if exists invoices_set_ref on invoices;
create trigger invoices_set_ref before insert on invoices for each row execute function set_ref('invoice', 'INV');

create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  contract_account_id uuid references contract_accounts(id) on delete set null,
  kind text not null check (kind in ('base_rent', 'setup_fee', 'turnover_topup', 'service', 'adjustment')),
  description text not null,
  period_start date,
  period_end date,
  days integer,
  days_in_month integer,
  snapshot jsonb not null default '{}'::jsonb,
  amount numeric not null,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists invoice_lines_dedupe_uidx on invoice_lines(dedupe_key);
create index if not exists invoice_lines_invoice_idx on invoice_lines(invoice_id);
alter table invoice_lines enable row level security;

insert into roles (name, level, is_system, description)
select 'Customer', 'merchant', true, 'Rents accounts — sees only their own accounts, contracts and invoices'
where not exists (select 1 from roles where name = 'Customer' and level = 'merchant' and is_system);

insert into role_permissions (role_id, module, action, scope)
select r.id, 'customer_portal', 'view', 'own'
from roles r where r.name = 'Customer' and r.level = 'merchant' and r.is_system
on conflict (role_id, module, action) do nothing;

insert into role_permissions (role_id, module, action, scope)
select r.id, m.module, a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('customers'), ('contracts'), ('billing')) as m(module)
cross join (values ('view'), ('add'), ('edit'), ('delete')) as a(action)
where r.is_system and r.name <> 'Customer' and r.name <> 'Agent'
on conflict (role_id, module, action) do nothing;

update app_config
set value = value || '{"customers": true, "contracts": true, "billing": true}'::jsonb
where key = 'modules';

-- The customer side reworked around assignment: accounts are assigned at the
-- customer's own default conditions, the customer reads the full agreement and
-- confirms before anything proceeds, and billing starts on binding — capped at
-- 14 days from assignment no matter what.

-- Customer default conditions, same shape as the agent table. The platform
-- template is country-scoped (merchant_id and customer_id both null); each
-- customer gets their own copy that may diverge. merchant_id is reserved for
-- white-label templates, to be designed later.
create table if not exists customer_condition_rows (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  bank_id uuid not null references banks(id) on delete cascade,
  channel text,
  mode text not null default 'max' check (mode in ('rent', 'turnover', 'rent_plus_turnover', 'max')),
  rent numeric not null default 0,
  turnover_pct numeric,
  setup_fee numeric not null default 0,
  deposit numeric not null default 0,
  contract_months integer,
  renewal_months integer,
  sort integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_condition_rows_lookup_idx
  on customer_condition_rows(country_id, customer_id, bank_id);
alter table customer_condition_rows enable row level security;

-- The fixed terms & conditions text, versioned and immutable: publishing is
-- adding a version, never editing one. Platform per country; a white label
-- row (merchant_id set) overrides for their own customers.
create table if not exists terms_documents (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  version integer not null,
  title text not null default 'Terms & Conditions',
  body text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists terms_documents_platform_uidx
  on terms_documents(country_id, version) where merchant_id is null;
create unique index if not exists terms_documents_merchant_uidx
  on terms_documents(country_id, merchant_id, version) where merchant_id is not null;
alter table terms_documents enable row level security;

-- An account offered to a customer. The conditions and the T&C version are
-- frozen here at assignment; the customer's confirmation and the delivery
-- fork play out on this row.
create table if not exists account_assignments (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  delivery_method text not null default 'direct' check (delivery_method in ('mail', 'direct')),
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'confirmed', 'live', 'cancelled')),
  conditions jsonb not null,
  tnc_id uuid references terms_documents(id) on delete set null,
  address jsonb,
  assigned_on date not null default current_date,
  confirmed_at timestamptz,
  live_on date,
  contract_account_id uuid references contract_accounts(id) on delete set null,
  binding_ticket_id uuid references tickets(id) on delete set null,
  cancel_reason text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live offer per account at a time.
create unique index if not exists account_assignments_open_uidx
  on account_assignments(bank_account_id) where status <> 'cancelled';
alter table account_assignments enable row level security;
drop trigger if exists account_assignments_set_ref on account_assignments;
create trigger account_assignments_set_ref before insert on account_assignments
  for each row execute function set_ref('assignment', 'ASG');

-- The customer's saved delivery addresses, reusable across assignments.
create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  phone text not null,
  address text not null,
  created_at timestamptz not null default now()
);
alter table customer_addresses enable row level security;

-- The binding ticket type is free — it is our onboarding work, not a service.
alter table ticket_types add column if not exists is_binding boolean not null default false;

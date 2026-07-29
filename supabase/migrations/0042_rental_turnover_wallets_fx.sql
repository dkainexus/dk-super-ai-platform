-- Batch 2: turnover declarations, party ledgers, and USDT rates.

create table if not exists turnover_declarations (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  period_month date not null,
  amount numeric not null,
  statement_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bank_account_id, period_month)
);
create index if not exists turnover_customer_idx on turnover_declarations(customer_id, period_month);
alter table turnover_declarations enable row level security;

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  holder_type text not null check (holder_type in ('customer', 'agent', 'merchant')),
  holder_id uuid not null,
  currency text not null,
  amount numeric not null,
  kind text not null check (kind in ('topup', 'invoice_payment', 'payout', 'adjustment')),
  invoice_id uuid references invoices(id) on delete set null,
  usdt_amount numeric,
  usdt_rate numeric,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_holder_idx on ledger_entries(holder_type, holder_id);
alter table ledger_entries enable row level security;

create table if not exists fx_rates (
  day date not null,
  currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (day, currency)
);
alter table fx_rates enable row level security;

alter table countries add column if not exists usdt_markup_pct numeric not null default 0;
alter table countries add column if not exists usdt_markup_flat numeric not null default 0;

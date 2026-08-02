-- Credits between the platform and its white labels: approving an agent's
-- owner submission spends them, buying them is a verified USDT transfer.
-- The ledger is the truth; the balance is its sum.
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('topup', 'approval', 'manual')),
  tx_hash text,
  usdt_amount numeric,
  owner_id uuid references owners(id) on delete set null,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index credit_ledger_tx_uidx on credit_ledger(tx_hash) where tx_hash is not null;
create index credit_ledger_merchant_idx on credit_ledger(merchant_id, created_at desc);
alter table credit_ledger enable row level security;

insert into app_config (key, value)
values ('credits', '{"usdt_per_credit": 10, "credits_per_approval": 1, "usdt_address_trc20": ""}'::jsonb)
on conflict (key) do nothing;

-- On-chain top-up confirmation: each country has one TRC20 deposit address,
-- and customers report the transaction hash; the chain is the referee.
alter table countries add column if not exists usdt_address_trc20 text;

create table if not exists topup_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  customer_id uuid not null references customers(id) on delete cascade,
  network text not null default 'trc20',
  tx_hash text not null,
  amount_usdt numeric,      -- what the customer says they sent
  chain_usdt numeric,       -- what the chain says actually arrived
  status text not null default 'pending' check (status in ('pending','credited','rejected')),
  verify_note text,
  verified jsonb,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- One hash can only ever be credited once, no matter who submits it.
create unique index if not exists topup_requests_tx_hash_key on topup_requests (lower(tx_hash));
alter table topup_requests enable row level security;

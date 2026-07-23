-- Wallet module: every owner gets a wallet. Rewards and rent are credited
-- into it (triggered or manual); owners request withdrawals from the app,
-- the platform pays out manually and updates the status.

create table wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references owners(id) on delete cascade,
  currency text not null,                      -- from the owner's country
  balance numeric(14,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  type text not null check (type in ('reward','rent','withdrawal','refund','adjustment')),
  amount numeric(14,2) not null,               -- signed: credit +, debit -
  reference text,                              -- idempotency key, e.g. 'training_complete'
  note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- One transaction per (wallet, reference): triggered rewards cannot double-pay.
create unique index wallet_tx_reference_idx
  on wallet_transactions (wallet_id, reference) where reference is not null;

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete cascade,
  owner_id uuid not null references owners(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  bank_name text,                              -- snapshot at request time
  bank_account_no text,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  reject_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references users(id)
);

-- Atomic ledger apply: creates the wallet on first use, locks the row,
-- refuses debits that would go below zero, inserts the transaction and
-- updates the cached balance in one transaction.
create or replace function wallet_apply(
  p_owner uuid,
  p_currency text,
  p_type text,
  p_amount numeric,
  p_reference text default null,
  p_note text default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
as $$
declare
  w_id uuid;
  w_balance numeric;
begin
  insert into wallets (owner_id, currency) values (p_owner, p_currency)
    on conflict (owner_id) do nothing;
  select id, balance into w_id, w_balance from wallets where owner_id = p_owner for update;
  if p_amount < 0 and w_balance + p_amount < 0 then
    raise exception 'insufficient_balance';
  end if;
  insert into wallet_transactions (wallet_id, type, amount, reference, note, created_by)
    values (w_id, p_type, p_amount, p_reference, p_note, p_created_by);
  update wallets set balance = balance + p_amount, updated_at = now() where id = w_id;
  return w_id;
end;
$$;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'wallet', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"wallet": true}'::jsonb where key = 'modules';

-- Default training-completion reward: 3000 THB for Thailand.
insert into app_config (key, value)
values ('wallet', jsonb_build_object('training_rewards',
  (select coalesce(jsonb_object_agg(id, 3000), '{}'::jsonb) from countries where code = 'TH')))
on conflict (key) do update set value = excluded.value;

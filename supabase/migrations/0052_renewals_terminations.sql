-- Renewals and terminations. Customers renew by hand in the portal, against
-- the current T&C. Owner and agent renewal is the white label's choice: auto,
-- or manual — meaning WE confirm it. An owner wanting out applies from the
-- app; the admin settles compensation with the agent before approving.

alter table merchants add column if not exists renew_owner_mode text not null default 'auto'
  check (renew_owner_mode in ('auto', 'manual'));
alter table merchants add column if not exists renew_agent_mode text not null default 'auto'
  check (renew_agent_mode in ('auto', 'manual'));

-- Every renewal is an acceptance on record: who, when, how long, which terms.
create table if not exists contract_renewals (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  months integer not null,
  old_ends_on date,
  new_ends_on date not null,
  tnc_id uuid references terms_documents(id) on delete set null,
  confirmed_by uuid references users(id) on delete set null,
  kind text not null default 'customer' check (kind in ('customer', 'auto', 'admin')),
  created_at timestamptz not null default now()
);
alter table contract_renewals enable row level security;

-- The owner's way out: a request, a negotiation, a decision.
create table if not exists termination_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  owner_id uuid not null references owners(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists termination_requests_open_uidx
  on termination_requests(bank_account_id) where status = 'pending';
alter table termination_requests enable row level security;

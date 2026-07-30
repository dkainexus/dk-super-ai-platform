-- Contract layer rework: the owner's terms hang on the owner (set by their
-- agent within the white label's bounds), and the agent's own conditions come
-- from a bank × channel table the white label maintains. Accounts snapshot
-- whatever applied on the day they were activated.

-- The white label's guardrails for what an agent may sign an owner up at.
create table if not exists contract_policies (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  owner_rent_min numeric not null default 0,
  owner_rent_max numeric not null default 0,
  owner_min_contract_months integer not null default 6,
  owner_min_renewal_months integer not null default 3,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (merchant_id, country_id)
);
alter table contract_policies enable row level security;

-- The owner's own terms, versioned: a change opens a new version from the 1st
-- of the next month and never rewrites a month already billed.
create table if not exists owner_contract_terms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  rent numeric not null,
  contract_months integer not null,
  renewal_months integer not null,
  effective_from date not null,
  effective_to date,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists owner_contract_terms_idx on owner_contract_terms(owner_id, effective_from);
alter table owner_contract_terms enable row level security;

-- The agent condition table: one row per bank (× channel; null channel is the
-- bank's default row). An activating account looks up its row and freezes it.
create table if not exists agent_condition_rows (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  bank_id uuid not null references banks(id) on delete cascade,
  channel text,
  mode text not null default 'rent' check (mode in ('rent', 'turnover', 'rent_plus_turnover', 'max')),
  rent numeric not null default 0,
  turnover_pct numeric,
  contract_months integer,
  renewal_months integer,
  deposit numeric not null default 0,
  sort integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists agent_condition_rows_exact_uidx
  on agent_condition_rows(merchant_id, country_id, bank_id, channel) where channel is not null;
create unique index if not exists agent_condition_rows_default_uidx
  on agent_condition_rows(merchant_id, country_id, bank_id) where channel is null;
alter table agent_condition_rows enable row level security;

-- How a terms version pays: rent only, turnover only, both added together, or
-- whichever is higher (the customer model). Existing rows keep 'max'.
alter table contract_terms add column if not exists mode text not null default 'max'
  check (mode in ('rent', 'turnover', 'rent_plus_turnover', 'max'));

-- Pure-turnover agents have no contract months to bound their liability — it
-- stays open for as long as the account is in use.
alter table contracts add column if not exists theft_window_open boolean not null default false;

-- The matrix row an account froze at activation, kept for display.
alter table contract_accounts add column if not exists agent_snapshot jsonb;

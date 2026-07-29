-- Branch directory per bank: seeded by admins, grown from processed app submissions
create table if not exists bank_branches (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references banks(id) on delete cascade,
  name text not null,
  address text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bank_branches_bank_idx on bank_branches(bank_id);

-- Accounts link to a processed branch; app submissions may instead carry a
-- Google Maps screenshot that admins turn into a branch before approval.
alter table bank_accounts add column if not exists branch_id uuid references bank_branches(id) on delete set null;
alter table bank_accounts add column if not exists branch_map_path text;

-- Extra account fields are defined per country (like payment channels); banks tick them.
alter table countries add column if not exists account_fields jsonb not null default '[]'::jsonb;
update countries set account_fields = '[{"key":"company_id","label":"Company ID"},{"key":"app_pin","label":"App PIN"}]'::jsonb
where code = 'TH' and account_fields = '[]'::jsonb;

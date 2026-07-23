-- Bank Accounts module install (see supabase/migrations/0021 for the live DB)

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  owner_id uuid references owners(id) on delete set null,        -- submitter (null = admin-created)
  company_id uuid not null references companies(id) on delete cascade,
  bank_id uuid not null references banks(id) on delete restrict,
  branch_address text,
  account_no text not null,
  account_limit numeric,
  email text,
  sim_number text,
  login_id text,
  password text,
  extra jsonb not null default '{}'::jsonb,      -- per-bank custom field values {key: value}
  channels jsonb not null default '{}'::jsonb,   -- {"PromptPay": {"enabled": true, "value": "081..."}}
  status text not null default 'pending' check (status in ('pending','active','suspended','closed','rejected')),
  condition text not null default 'New',
  reject_reason text,
  activated_at timestamptz,
  suspended_at timestamptz,
  closed_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_merchant_idx on bank_accounts(merchant_id, status);
create index if not exists bank_accounts_owner_idx on bank_accounts(owner_id);

-- Banks carry per-bank extras used by this module
alter table banks add column if not exists logo_path text;
alter table banks add column if not exists account_fields jsonb not null default '[]'::jsonb;
alter table banks add column if not exists channels jsonb not null default '[]'::jsonb;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'bank_accounts', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"bank_accounts": true}'::jsonb where key = 'modules';

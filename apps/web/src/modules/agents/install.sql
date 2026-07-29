-- Agents: people who recruit owners for a white label.
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  ref text,
  full_name text not null,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  invite_token text,
  invited_at timestamptz,
  joined_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agents_merchant_idx on agents(merchant_id);
create unique index if not exists agents_ref_uidx on agents(ref) where ref is not null;
create unique index if not exists agents_invite_token_uidx on agents(invite_token) where invite_token is not null;
alter table agents enable row level security;

drop trigger if exists agents_set_ref on agents;
create trigger agents_set_ref before insert on agents for each row execute function set_ref('agent', 'AGT');

alter table owners add column if not exists agent_id uuid references agents(id) on delete set null;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'agents', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"agents": true}'::jsonb where key = 'modules';

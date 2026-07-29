-- States / provinces, so address fields are a dropdown rather than free text
create table if not exists provinces (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null, sort integer not null default 100, active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
alter table provinces enable row level security;

alter table owners add column if not exists address_no text;
alter table owners add column if not exists street text;
alter table owners add column if not exists subdistrict text;
alter table owners add column if not exists district text;
alter table owners add column if not exists province text;
alter table owners add column if not exists postal_code text;

-- Agents sit under a white label and are who normally register owners
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  ref text, full_name text not null, phone text, email text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists agents_merchant_idx on agents(merchant_id);
create unique index if not exists agents_ref_uidx on agents(ref) where ref is not null;
alter table agents enable row level security;
drop trigger if exists agents_set_ref on agents;
create trigger agents_set_ref before insert on agents for each row execute function set_ref('agent', 'AGT');
alter table owners add column if not exists agent_id uuid references agents(id) on delete set null;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'agents', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system on conflict (role_id, module, action) do nothing;
update app_config set value = value || '{"agents": true}'::jsonb where key = 'modules';

-- Company types per country, one marked default
create table if not exists company_types (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null, is_default boolean not null default false, sort integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
alter table company_types enable row level security;

-- Question bank categories + exam modes (bank draw vs AI interviewer)
create table if not exists question_categories (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id) on delete cascade,
  name text not null, sort integer not null default 100,
  created_at timestamptz not null default now()
);
alter table question_categories enable row level security;
alter table exam_questions add column if not exists category_id uuid references question_categories(id) on delete set null;
alter table exams add column if not exists mode text not null default 'bank' check (mode in ('bank', 'ai_interview'));
alter table exams add column if not exists category_id uuid references question_categories(id) on delete set null;
alter table exams add column if not exists ai_brief text;
alter table exams add column if not exists ai_question_count integer default 5;
alter table exam_attempts add column if not exists transcript jsonb;

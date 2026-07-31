-- HR: the platform's own people. Employees are ours alone — no white label —
-- so their refs count on a platform counter (TH-EMP-00001), and the module's
-- permissions go to platform roles only.

create table platform_ref_counters (
  country_id uuid not null references countries(id) on delete cascade,
  entity text not null,
  next_val integer not null default 1,
  primary key (country_id, entity)
);
alter table platform_ref_counters enable row level security;

create or replace function next_platform_ref(p_country uuid, p_entity text, p_prefix text)
returns text language plpgsql as $$
declare v_code text; v_num integer;
begin
  if p_country is null then return null; end if;
  select code into v_code from countries where id = p_country;
  if v_code is null then return null; end if;
  insert into platform_ref_counters (country_id, entity, next_val) values (p_country, p_entity, 1)
  on conflict (country_id, entity) do update set next_val = platform_ref_counters.next_val + 1
  returning next_val into v_num;
  return v_code || '-' || p_prefix || '-' || lpad(v_num::text, 5, '0');
end $$;

create or replace function set_platform_ref() returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := next_platform_ref(new.country_id, tg_argv[0], tg_argv[1]);
  end if;
  return new;
end $$;

create table departments (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
alter table departments enable row level security;

create table employees (
  id uuid primary key default gen_random_uuid(),
  ref text,
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  national_id text,
  phone text,
  email text,
  department_id uuid references departments(id) on delete set null,
  position text,
  hired_on date not null default current_date,
  base_salary numeric not null default 0,
  currency text,
  bank_name text,
  bank_account_no text,
  user_id uuid references users(id) on delete set null,
  status text not null default 'probation' check (status in ('probation', 'active', 'resigned', 'terminated')),
  left_on date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references users(id) on delete set null
);
alter table employees enable row level security;
create trigger employees_set_ref before insert on employees for each row execute function set_platform_ref('employee', 'EMP');

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  path text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references users(id) on delete set null
);
alter table employee_documents enable row level security;

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  period_month date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references users(id) on delete set null,
  unique (country_id, period_month)
);
alter table payroll_runs enable row level security;

create table payroll_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  base_salary numeric not null default 0,
  bonus numeric not null default 0,
  deduction numeric not null default 0,
  note text,
  unique (run_id, employee_id)
);
alter table payroll_items enable row level security;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'hr', a.action, 'all'
from roles r
cross join (values ('view'), ('add'), ('edit'), ('delete')) as a(action)
where r.is_system and r.level = 'platform'
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"hr": true}'::jsonb where key = 'modules';

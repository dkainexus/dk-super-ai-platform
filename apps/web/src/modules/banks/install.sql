-- Banks module install (per-country bank directory)

create table if not exists banks (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

-- Register permissions for system roles + enable the module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'banks', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"banks": true}'::jsonb where key = 'modules';

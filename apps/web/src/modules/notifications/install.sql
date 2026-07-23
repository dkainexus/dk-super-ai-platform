-- Notifications module install (in-app notifications for owners)

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  type text not null default 'general'
    check (type in ('general','company','reward','training','exam')),
  title text not null,
  body text,
  read_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_owner_idx
  on notifications(owner_id, created_at desc);

-- Register permissions for system roles + enable the module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'notifications', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"notifications": true}'::jsonb where key = 'modules';

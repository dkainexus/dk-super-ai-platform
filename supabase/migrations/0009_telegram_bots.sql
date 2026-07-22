-- Telegram module: shared bot registry. Bots are platform-wide resources;
-- what each bot is used for gets attached later (webhook flows, notifications…).

create table telegram_bots (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- display label
  token text unique not null,
  bot_username text,                  -- from Telegram getMe, e.g. MyBot (no @)
  note text,
  active boolean not null default true,
  last_check_ok boolean,
  last_check_at timestamptz,
  created_at timestamptz not null default now()
);

insert into role_permissions (role_id, module, action, scope)
select r.id, 'telegram', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"telegram": true}'::jsonb where key = 'modules';

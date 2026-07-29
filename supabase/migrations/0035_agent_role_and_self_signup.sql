-- Agents recruit owners. They sign in on the white-label side and only ever
-- see the owners they entered themselves.
insert into roles (name, level, is_system, description)
select 'Agent', 'merchant', true, 'Recruits owners for a white label — sees only their own records'
where not exists (select 1 from roles where name = 'Agent' and level = 'merchant' and is_system);

insert into role_permissions (role_id, module, action, scope)
select r.id, 'owners', a.action, 'own'
from roles r cross join (values ('view'), ('add'), ('edit')) as a(action)
where r.name = 'Agent' and r.level = 'merchant' and r.is_system
on conflict (role_id, module, action) do nothing;

-- Self sign-up: the back office issues a one-time link the agent opens to set
-- their own name and password.
alter table agents add column if not exists invite_token text;
alter table agents add column if not exists invited_at timestamptz;
alter table agents add column if not exists joined_at timestamptz;
create unique index if not exists agents_invite_token_uidx on agents(invite_token) where invite_token is not null;

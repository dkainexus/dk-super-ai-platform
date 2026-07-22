-- AI Assistant module: role-scoped Q&A over platform data.
-- No new tables — provider config (Claude / ChatGPT API keys) lives in
-- app_config under key 'ai'. This migration only registers permissions
-- and enables the module toggle.

insert into role_permissions (role_id, module, action, scope)
select r.id, 'ai', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"ai": true}'::jsonb where key = 'modules';

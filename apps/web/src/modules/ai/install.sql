-- AI Assistant module install
-- No tables: provider config (Claude / ChatGPT keys) lives in app_config
-- under key 'ai'; conversations are not persisted.

-- Register permissions for system roles + enable the module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'ai', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"ai": true}'::jsonb where key = 'modules';

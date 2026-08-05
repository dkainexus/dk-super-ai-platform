-- Customers are leaving for the industry platform: their portal sign-ins are
-- retired and the Customer role goes away entirely.
update users set active = false, role_id = null
where role_id in (select id from roles where name = 'Customer' and level = 'merchant' and is_system);
delete from role_permissions
where role_id in (select id from roles where name = 'Customer' and level = 'merchant' and is_system);
delete from roles where name = 'Customer' and level = 'merchant' and is_system;

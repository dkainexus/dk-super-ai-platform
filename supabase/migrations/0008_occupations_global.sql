-- Occupations become a single global list (shared by all countries) and move
-- out of the module system — managed under Settings instead.

alter table occupations drop constraint occupations_country_id_name_key;
alter table occupations drop column country_id;
alter table occupations add constraint occupations_name_key unique (name);

delete from role_permissions where module = 'occupations';
update app_config set value = value - 'occupations' where key = 'modules';

-- Freshly generated app logins start on the shared password and must be changed
alter table owners add column if not exists app_must_change_password boolean not null default false;

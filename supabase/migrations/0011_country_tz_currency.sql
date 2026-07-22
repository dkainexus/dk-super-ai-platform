-- Countries as workspaces: every country carries its timezone and currency.
-- Merchants (displayed as "White Label") inherit both from their country.

alter table countries add column if not exists timezone text not null default 'UTC';
alter table countries add column if not exists currency text not null default 'USD';

update countries set timezone = 'Asia/Bangkok', currency = 'THB' where code = 'TH';

-- Display rename: the "Merchant Owner" system role becomes "White Label Owner".
update roles set name = 'White Label Owner', description = 'Full access to everything inside the white label'
where name = 'Merchant Owner' and is_system;

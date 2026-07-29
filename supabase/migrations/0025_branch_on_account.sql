-- Google is the source of truth for branches: store the picked place on the
-- account itself instead of maintaining a local directory that drifts.
alter table bank_accounts add column if not exists branch_name text;
alter table bank_accounts add column if not exists branch_address text;
alter table bank_accounts add column if not exists branch_place_id text;
alter table bank_accounts add column if not exists branch_lat double precision;
alter table bank_accounts add column if not exists branch_lng double precision;
alter table bank_accounts drop column if exists branch_id;
drop table if exists bank_branches;

-- Condition is a fixed choice, set at creation (default New).
update bank_accounts set condition = 'New' where condition is null or condition not in ('New', 'Old');
alter table bank_accounts drop constraint if exists bank_accounts_condition_check;
alter table bank_accounts add constraint bank_accounts_condition_check check (condition in ('New', 'Old'));

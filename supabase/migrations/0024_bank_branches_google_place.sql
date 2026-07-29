-- Branches sourced from Google Places (New): place_id dedupes the same branch
-- across submissions; coordinates let us map/verify them later.
alter table bank_branches add column if not exists place_id text;
alter table bank_branches add column if not exists lat double precision;
alter table bank_branches add column if not exists lng double precision;
create unique index if not exists bank_branches_place_uidx
  on bank_branches(bank_id, place_id) where place_id is not null;

-- The Maps-screenshot flow is replaced by Google Places lookups.
alter table bank_accounts drop column if exists branch_map_path;

-- The branch record carries the address now; the free-text field is gone.
alter table bank_accounts drop column if exists branch_address;

-- Administrative areas differ per country: Thailand and Malaysia have three
-- levels, Australia and Vietnam two, Singapore one. So the depth and the level
-- names are configured per country and the areas themselves live in one tree.
alter table countries add column if not exists address_levels text[] not null default '{}';

create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  parent_id uuid references regions(id) on delete cascade,
  level integer not null default 1,
  name text not null,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, parent_id, name)
);
create index if not exists regions_country_level_idx on regions(country_id, level);
create index if not exists regions_parent_idx on regions(parent_id);
alter table regions enable row level security;

-- The old flat province list becomes level 1 of the tree.
insert into regions (country_id, parent_id, level, name, active, sort)
select p.country_id, null, 1, p.name, p.active, p.sort
from provinces p
on conflict (country_id, parent_id, name) do nothing;

drop table if exists provinces;

-- Level names for the countries the platform launches in.
update countries set address_levels = array['Province', 'District', 'Sub-district'] where code = 'TH';
update countries set address_levels = array['Province', 'Ward'] where code = 'VN';
update countries set address_levels = array['State', 'District', 'Mukim'] where code = 'MY';
update countries set address_levels = array['District'] where code = 'SG';
update countries set address_levels = array['State', 'Suburb'] where code = 'AU';
update countries set address_levels = array['State / Province', 'District', 'Sub-district']
where address_levels = '{}';

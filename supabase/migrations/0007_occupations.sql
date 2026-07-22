-- Occupations module: per-country occupation master data.
-- Each occupation can carry the company type it maps to — this is the input
-- for deciding what kind of company to register for an owner.

create table occupations (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  company_type text,                  -- e.g. 'Limited Company', filled by the platform admin
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
create index occupations_country_idx on occupations (country_id, active);

alter table owners add column occupation_id uuid references occupations(id) on delete set null;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'occupations', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"occupations": true}'::jsonb where key = 'modules';

-- Seed: common Thai occupations (company_type left for the admin to fill).
insert into occupations (country_id, name, sort)
select c.id, o.name, o.sort
from countries c
cross join (values
  ('Company Employee', 10),
  ('Government Officer', 20),
  ('State Enterprise Employee', 30),
  ('Business Owner / Merchant', 40),
  ('Self-Employed', 50),
  ('Freelancer', 60),
  ('Farmer', 70),
  ('Teacher / Lecturer', 80),
  ('Doctor / Nurse', 90),
  ('Engineer', 100),
  ('Driver / Rider', 110),
  ('Student', 120),
  ('Housewife / Househusband', 130),
  ('Retired', 140),
  ('Unemployed', 150),
  ('Other', 160)
) as o(name, sort)
where c.code = 'TH'
on conflict (country_id, name) do nothing;

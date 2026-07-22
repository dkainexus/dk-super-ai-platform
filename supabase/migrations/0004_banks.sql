-- Banks module: per-country bank master data.

-- Free up the `banks` name: the legacy bot-flow table (empty, Phase 2 never
-- built) becomes candidate_banks; its FK from bank_status_logs follows along.
alter table banks rename to candidate_banks;

create table banks (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  code text,                          -- short code, e.g. KBANK
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
create index banks_country_idx on banks (country_id, active);

-- Grant the module to the seeded system roles (superadmins bypass anyway).
insert into role_permissions (role_id, module, action, scope)
select r.id, 'banks', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

-- Enable the module globally.
update app_config set value = value || '{"banks": true}'::jsonb where key = 'modules';

-- Seed: Thai banks.
insert into banks (country_id, name, code, sort)
select c.id, b.name, b.code, b.sort
from countries c
cross join (values
  ('Bangkok Bank', 'BBL', 10),
  ('Kasikornbank', 'KBANK', 20),
  ('Krung Thai Bank', 'KTB', 30),
  ('Siam Commercial Bank', 'SCB', 40),
  ('Bank of Ayudhya (Krungsri)', 'BAY', 50),
  ('TMBThanachart Bank', 'TTB', 60),
  ('Government Savings Bank', 'GSB', 70),
  ('Bank for Agriculture and Agricultural Cooperatives', 'BAAC', 80),
  ('Government Housing Bank', 'GHB', 90),
  ('Kiatnakin Phatra Bank', 'KKP', 100),
  ('CIMB Thai Bank', 'CIMBT', 110),
  ('United Overseas Bank (Thai)', 'UOBT', 120),
  ('Land and Houses Bank', 'LHB', 130),
  ('ICBC (Thai)', 'ICBCT', 140),
  ('Thai Credit Bank', 'TCB', 150),
  ('Islamic Bank of Thailand', 'IBANK', 160),
  ('Export-Import Bank of Thailand', 'EXIM', 170),
  ('SME Development Bank', 'SMED', 180)
) as b(name, code, sort)
where c.code = 'TH'
on conflict (country_id, name) do nothing;

-- White labels can operate in multiple countries. No "primary country" —
-- every owner/company records its own country, picked at creation from the
-- white label's enabled countries.

create table merchant_countries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid not null references countries(id),
  created_at timestamptz not null default now(),
  unique (merchant_id, country_id)
);

insert into merchant_countries (merchant_id, country_id)
select id, country_id from merchants;

alter table merchants drop column country_id;

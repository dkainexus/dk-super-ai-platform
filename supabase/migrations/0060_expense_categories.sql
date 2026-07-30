-- Expense categories become data: per country, addable, switchable — the
-- hardcoded list and the device-models catalog both retire. What was bought
-- is now a free "item" text on the expense itself.
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);
alter table expense_categories enable row level security;

insert into expense_categories (country_id, name)
select c.id, cat.name
from countries c
cross join (values
  ('Company registration'), ('Legal'), ('Device'), ('Travel'), ('Escort'), ('Other')
) as cat(name);

alter table expenses add column if not exists item text;
alter table expenses drop column if exists device_model_id;
drop table if exists device_models;

-- References read TH-CMP-BL00001: country, entity, white-label code + number.
alter table merchants add column if not exists code text;
create unique index if not exists merchants_code_uidx on merchants(code) where code is not null;

alter table ref_counters add column if not exists merchant_id uuid references merchants(id) on delete cascade;
alter table ref_counters drop constraint if exists ref_counters_pkey;
delete from ref_counters;
alter table ref_counters alter column merchant_id set not null;
alter table ref_counters add primary key (country_id, entity, merchant_id);

create or replace function next_ref(p_country uuid, p_entity text, p_prefix text, p_merchant uuid default null)
returns text language plpgsql as $$
declare v_code text; v_wl text; v_num integer;
begin
  if p_country is null or p_merchant is null then return null; end if;
  select code into v_code from countries where id = p_country;
  select coalesce(code, 'XX') into v_wl from merchants where id = p_merchant;
  if v_code is null then return null; end if;
  insert into ref_counters (country_id, entity, merchant_id, next_val) values (p_country, p_entity, p_merchant, 1)
  on conflict (country_id, entity, merchant_id) do update set next_val = ref_counters.next_val + 1
  returning next_val into v_num;
  return v_code || '-' || p_prefix || '-' || v_wl || lpad(v_num::text, 5, '0');
end $$;

create or replace function set_ref() returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := next_ref(new.country_id, tg_argv[0], tg_argv[1], new.merchant_id);
  end if;
  return new;
end $$;

-- ---------- Country icon + occupation categories + multi-select fields ----------
alter table countries add column if not exists icon_path text;

create table if not exists occupation_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort integer not null default 100,
  created_at timestamptz not null default now()
);
alter table occupations add column if not exists category_id uuid references occupation_categories(id) on delete set null;
alter table occupations drop column if exists company_type;

alter table country_fields drop constraint if exists country_fields_field_type_check;
alter table country_fields add constraint country_fields_field_type_check
  check (field_type in ('text','number','date','file','select','multiselect'));

-- ---------- Reference numbers (VN-OWN-000123) ----------
create table if not exists ref_counters (
  country_id uuid not null references countries(id) on delete cascade,
  entity text not null,
  next_val integer not null default 1,
  primary key (country_id, entity)
);

create or replace function next_ref(p_country uuid, p_entity text, p_prefix text)
returns text language plpgsql as $$
declare
  v_code text;
  v_num integer;
begin
  if p_country is null then return null; end if;
  select code into v_code from countries where id = p_country;
  if v_code is null then return null; end if;
  insert into ref_counters (country_id, entity, next_val) values (p_country, p_entity, 1)
  on conflict (country_id, entity) do update set next_val = ref_counters.next_val + 1
  returning next_val into v_num;
  return v_code || '-' || p_prefix || '-' || lpad(v_num::text, 6, '0');
end $$;

alter table owners add column if not exists ref text;
alter table companies add column if not exists ref text;
alter table bank_accounts add column if not exists ref text;
create unique index if not exists owners_ref_uidx on owners(ref) where ref is not null;
create unique index if not exists companies_ref_uidx on companies(ref) where ref is not null;
create unique index if not exists bank_accounts_ref_uidx on bank_accounts(ref) where ref is not null;

create or replace function set_ref() returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := next_ref(new.country_id, tg_argv[0], tg_argv[1]);
  end if;
  return new;
end $$;

drop trigger if exists owners_set_ref on owners;
create trigger owners_set_ref before insert on owners for each row execute function set_ref('owner', 'OWN');
drop trigger if exists companies_set_ref on companies;
create trigger companies_set_ref before insert on companies for each row execute function set_ref('company', 'CMP');
drop trigger if exists bank_accounts_set_ref on bank_accounts;
create trigger bank_accounts_set_ref before insert on bank_accounts for each row execute function set_ref('bank_account', 'ACC');

-- ---------- Rewards per training/exam + white-label attribution ----------
alter table training_videos add column if not exists reward_amount numeric;
alter table training_videos add column if not exists auto_notify boolean not null default true;
alter table exams add column if not exists reward_amount numeric;
alter table exams add column if not exists auto_notify boolean not null default true;

alter table wallet_transactions add column if not exists merchant_id uuid references merchants(id) on delete set null;
create index if not exists wallet_transactions_merchant_idx on wallet_transactions(merchant_id, created_at desc);

-- ---------- Per-white-label branded apps ----------
alter table merchants add column if not exists app_name text;
alter table merchants add column if not exists app_icon_path text;
alter table merchants add column if not exists app_package_id text;

create table if not exists app_builds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  version_name text not null,
  version_code integer not null,
  status text not null default 'queued' check (status in ('queued','building','ready','failed')),
  apk_path text,
  log text,
  requested_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_builds_merchant_idx on app_builds(merchant_id, created_at desc);

-- wallet_apply records the white label the movement belongs to
drop function if exists wallet_apply(uuid, text, text, numeric, text, text, uuid);
create or replace function wallet_apply(
  p_owner uuid, p_currency text, p_type text, p_amount numeric,
  p_reference text default null, p_note text default null,
  p_created_by uuid default null, p_merchant uuid default null
) returns uuid language plpgsql as $$
declare v_wallet uuid; v_balance numeric; v_merchant uuid;
begin
  select id, balance into v_wallet, v_balance from wallets where owner_id = p_owner for update;
  if v_wallet is null then
    insert into wallets (owner_id, currency, balance) values (p_owner, p_currency, 0)
    returning id, balance into v_wallet, v_balance;
  end if;
  if v_balance + p_amount < 0 then raise exception 'Insufficient balance'; end if;
  v_merchant := coalesce(p_merchant, (select merchant_id from owners where id = p_owner));
  insert into wallet_transactions (wallet_id, type, amount, reference, note, created_by, merchant_id)
  values (v_wallet, p_type, p_amount, p_reference, p_note, p_created_by, v_merchant);
  update wallets set balance = balance + p_amount, updated_at = now() where id = v_wallet;
  return v_wallet;
end $$;

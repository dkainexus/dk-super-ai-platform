-- Batch 3: tickets, service charges, and the billing freeze.

create table if not exists ticket_types (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  name text not null,
  default_assignee text not null default 'owner' check (default_assignee in ('owner', 'phone_cs', 'customer')),
  window_days integer not null default 14,
  phone_price numeric not null default 0,
  visit_price numeric not null default 0,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  unique (country_id, merchant_id, name)
);
alter table ticket_types enable row level security;

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  type_id uuid references ticket_types(id) on delete set null,
  description text not null,
  reported_balance numeric,
  last_transaction text,
  status text not null default 'open'
    check (status in ('open', 'assigned', 'handled', 'resolved')),
  assigned_to text check (assigned_to in ('owner', 'phone_cs', 'customer')),
  deadline date,
  escort_required boolean not null default false,
  escort_name text,
  charge_amount numeric,
  charge_kind text check (charge_kind in ('phone', 'visit')),
  charge_waived boolean not null default false,
  charge_invoiced_at timestamptz,
  assigned_by uuid references users(id) on delete set null,
  assigned_at timestamptz,
  closed_by uuid references users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tickets_account_idx on tickets(bank_account_id);
create index if not exists tickets_status_idx on tickets(status, deadline);
create unique index if not exists tickets_ref_uidx on tickets(ref) where ref is not null;
alter table tickets enable row level security;
drop trigger if exists tickets_set_ref on tickets;
create trigger tickets_set_ref before insert on tickets for each row execute function set_ref('ticket', 'TIC');

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'staff', 'owner')),
  author_id uuid,
  body text,
  attachment_path text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on ticket_messages(ticket_id);
alter table ticket_messages enable row level security;

alter table bank_accounts add column if not exists billing_frozen boolean not null default false;
alter table bank_accounts add column if not exists frozen_at timestamptz;
alter table bank_accounts add column if not exists frozen_reason text;

alter table merchant_countries add column if not exists escort_threshold numeric;

insert into role_permissions (role_id, module, action, scope)
select r.id, 'tickets', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system and r.name not in ('Customer', 'Agent')
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"tickets": true}'::jsonb where key = 'modules';

-- Shipping becomes its own module: one queue for everything that leaves the
-- building. Shipments hang off their source (assignments today, anything
-- later); the courier trail lives here, not on the assignment.
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  ref text,
  merchant_id uuid not null references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  source_type text not null default 'assignment',
  assignment_id uuid references account_assignments(id) on delete cascade,
  address jsonb not null,
  courier text,
  tracking_no text,
  shipped_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);
create index if not exists shipments_assignment_idx on shipments(assignment_id);
alter table shipments enable row level security;
drop trigger if exists shipments_set_ref on shipments;
create trigger shipments_set_ref before insert on shipments for each row execute function set_ref('shipment', 'SHP');

-- The courier trail moves off the assignment.
alter table account_assignments drop column if exists courier;
alter table account_assignments drop column if exists tracking_no;
alter table account_assignments drop column if exists shipped_at;
alter table account_assignments drop column if exists received_at;

-- Module permissions: platform staff only — white labels don't ship.
insert into role_permissions (role_id, module, action, scope)
select r.id, 'shipping', a.action, 'all'
from roles r
cross join (values ('view'), ('add'), ('edit'), ('delete')) as a(action)
where r.is_system and r.level = 'platform'
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"shipping": true}'::jsonb where key = 'modules';

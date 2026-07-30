-- A cancelled shipment says why and by whom — cancel is the only exit,
-- blank or not; nothing in the courier trail is ever deleted.
alter table shipments add column if not exists cancel_reason text;
alter table shipments add column if not exists cancelled_by uuid references users(id) on delete set null;

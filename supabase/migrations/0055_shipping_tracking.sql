-- The shipping leg, on the record: what was sent with which courier, when,
-- and when the customer said it arrived. Billing still starts only on
-- Account Tested (or the day-14 cap).
alter table account_assignments add column if not exists courier text;
alter table account_assignments add column if not exists tracking_no text;
alter table account_assignments add column if not exists shipped_at timestamptz;
alter table account_assignments add column if not exists received_at timestamptz;

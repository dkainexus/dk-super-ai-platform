-- The transaction's own time on chain, kept with the record: a transfer that
-- happened long before it was reported is not accepted automatically.
alter table topup_requests add column if not exists chain_time timestamptz;

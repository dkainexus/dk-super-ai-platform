-- Per-country module opt-outs: each country decides which business modules
-- run there (on top of the global switch and per-white-label opt-outs).
alter table countries add column disabled_modules jsonb not null default '[]';

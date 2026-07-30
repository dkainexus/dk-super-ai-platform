-- Conditions are per agent (user's call): the white label keeps a default
-- template (agent_id null), creating an agent copies it into their own table,
-- and each agent's deal can then diverge. Activation reads the agent's own
-- rows only.
alter table agent_condition_rows add column if not exists agent_id uuid references agents(id) on delete cascade;
drop index if exists agent_condition_rows_exact_uidx;
drop index if exists agent_condition_rows_default_uidx;
create index if not exists agent_condition_rows_lookup_idx
  on agent_condition_rows(merchant_id, country_id, agent_id, bank_id);

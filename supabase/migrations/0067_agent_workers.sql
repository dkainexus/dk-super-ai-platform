-- An agent's workers sign in with their own account but act as the agent:
-- users.agent_id ties the sub-account to the agent record, so everything they
-- enter (owners, etc.) lands under that agent. The primary sign-in remains
-- agents.user_id.
alter table users add column if not exists agent_id uuid references agents(id) on delete set null;
create index if not exists users_agent_id_idx on users(agent_id) where agent_id is not null;

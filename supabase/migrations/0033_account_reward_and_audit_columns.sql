-- Per-country reward for a new bank account, plus "who last touched this row"
-- columns so every module can show the person who entered the data.

alter table countries add column if not exists new_account_reward numeric not null default 0;

alter table owners add column if not exists updated_by uuid references users(id) on delete set null;
alter table companies add column if not exists updated_by uuid references users(id) on delete set null;
alter table bank_accounts add column if not exists updated_by uuid references users(id) on delete set null;
alter table banks add column if not exists updated_by uuid references users(id) on delete set null;
alter table banks add column if not exists created_by uuid references users(id) on delete set null;
alter table banks add column if not exists updated_at timestamptz not null default now();
alter table training_videos add column if not exists updated_by uuid references users(id) on delete set null;
alter table exams add column if not exists updated_by uuid references users(id) on delete set null;

-- Image fields the back office may download in one click (ID front/back etc.)
alter table country_fields add column if not exists downloadable boolean not null default false;

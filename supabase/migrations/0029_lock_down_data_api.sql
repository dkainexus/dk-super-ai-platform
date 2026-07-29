-- Close the public data API.
--
-- Everything that talks to Postgres — apps/web, the Telegram bots, the mobile
-- app's API routes — goes through packages/shared/db.js or
-- apps/web/src/lib/supabase.ts, both of which use the service role key from
-- the server. Nothing queries Postgres from the browser or from the Expo app.
--
-- Supabase grants the `anon` and `authenticated` roles table privileges by
-- default and new tables have RLS off, so without this migration anyone
-- holding the project's anon key — public by design — could read and write
-- every table, password hashes included.
--
-- service_role BYPASSES RLS, so the application is unaffected.
--
-- Every new module migration must repeat `alter table <t> enable row level
-- security;` for its own tables. The default-privilege revokes below are a
-- backstop, not the guard.

alter table app_builds                  enable row level security;
alter table app_config                  enable row level security;
alter table app_releases                enable row level security;
alter table appointments                enable row level security;
alter table bank_accounts               enable row level security;
alter table bank_status_logs            enable row level security;
alter table banks                       enable row level security;
alter table bot_jobs                    enable row level security;
alter table bot_registry                enable row level security;
alter table candidate_banks             enable row level security;
alter table candidate_companies         enable row level security;
alter table candidate_training_progress enable row level security;
alter table candidates                  enable row level security;
alter table certificates                enable row level security;
alter table companies                   enable row level security;
alter table company_members             enable row level security;
alter table countries                   enable row level security;
alter table country_fields              enable row level security;
alter table document_submissions        enable row level security;
alter table exam_attempts               enable row level security;
alter table exam_items                  enable row level security;
alter table exam_questions              enable row level security;
alter table exam_results                enable row level security;
alter table exam_videos                 enable row level security;
alter table exams                       enable row level security;
alter table group_bindings              enable row level security;
alter table group_topics                enable row level security;
alter table groups                      enable row level security;
alter table meeting_reports             enable row level security;
alter table merchant_countries          enable row level security;
alter table merchant_users              enable row level security;
alter table merchants                   enable row level security;
alter table notifications               enable row level security;
alter table occupation_categories       enable row level security;
alter table occupations                 enable row level security;
alter table owner_field_values          enable row level security;
alter table owners                      enable row level security;
alter table ref_counters                enable row level security;
alter table role_permissions            enable row level security;
alter table roles                       enable row level security;
alter table staff                       enable row level security;
alter table telegram_bots               enable row level security;
alter table topic_messages              enable row level security;
alter table training_progress           enable row level security;
alter table training_videos             enable row level security;
alter table user_countries              enable row level security;
alter table users                       enable row level security;
alter table wallet_transactions         enable row level security;
alter table wallets                     enable row level security;
alter table withdrawals                 enable row level security;

-- Belt and braces: take the table privileges away from the API roles, so a
-- future module table that forgets `enable row level security` is still safe.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

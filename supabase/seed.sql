-- Bootstrap CEO account for the web dashboard.
-- Default credentials: admin / 123456 — must_change_password forces a reset
-- on first login. Telegram identity is linked later via /claimowner-style
-- bootstrap in the bots (telegram_user_id stays null until then).
insert into staff (name, role, username, password_hash, must_change_password)
values ('Admin', 'ceo', 'admin', '$2b$10$9AugMxmN3U4AlzTWX/ji1ug4cUfc.IPk04GdPQcmkXUf9fyjf.JrK', true)
on conflict (username) do nothing;

insert into bot_registry (bot_key, display_name)
values
  ('group_ops', 'Group Ops Bot'),
  ('onboarding', 'Onboarding Bot'),
  ('training', 'Training Bot'),
  ('banking', 'Banking Bot'),
  ('super_ai', 'Super AI Bot')
on conflict (bot_key) do nothing;

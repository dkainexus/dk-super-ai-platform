-- In-app update channel: APK releases uploaded to storage; the app checks
-- /api/app/version and offers a one-tap download + install.
create table app_releases (
  id uuid primary key default gen_random_uuid(),
  version_code integer unique not null,      -- monotonically increasing
  version_name text not null,                -- e.g. 1.2.0
  notes text,
  apk_path text not null,
  published boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', false)
on conflict (id) do nothing;

-- Training module (videos + per-owner progress), Notifications module,
-- and owner app login credentials for the mobile app.

-- ---------- Training ----------

create table if not exists training_videos (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,  -- null = all white labels
  country_id uuid references countries(id) on delete cascade,   -- null = all countries
  title text not null,
  description text,
  video_path text not null,            -- storage path in training-videos bucket
  thumb_path text,                     -- optional poster frame (jpeg)
  duration_seconds integer,
  sort integer not null default 100,
  published boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_progress (
  owner_id uuid not null references owners(id) on delete cascade,
  video_id uuid not null references training_videos(id) on delete cascade,
  seconds_watched integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_id, video_id)
);

-- ---------- Notifications ----------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  type text not null default 'general'
    check (type in ('general','company','reward','training','exam')),
  title text not null,
  body text,
  read_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_owner_idx
  on notifications(owner_id, created_at desc);

-- ---------- Owner app access ----------

alter table owners add column if not exists app_username text;
alter table owners add column if not exists app_password_hash text;
alter table owners add column if not exists app_last_login_at timestamptz;

create unique index if not exists owners_app_username_idx
  on owners (lower(app_username)) where app_username is not null;

-- ---------- Storage ----------

insert into storage.buckets (id, name, public)
values ('training-videos', 'training-videos', false)
on conflict (id) do nothing;

-- ---------- Permissions + module toggles ----------

insert into role_permissions (role_id, module, action, scope)
select r.id, m.module, a.action,
       case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('training'),('notifications')) as m(module)
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config
set value = value || '{"training": true, "notifications": true}'::jsonb
where key = 'modules';

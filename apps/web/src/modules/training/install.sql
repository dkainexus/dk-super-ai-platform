-- Training module install (video library + per-owner watch progress)

create table if not exists training_videos (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,  -- null = all white labels
  country_id uuid references countries(id) on delete cascade,   -- null = all countries
  title text not null,
  description text,
  video_path text not null,            -- storage path in training-videos bucket
  thumb_path text,
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

insert into storage.buckets (id, name, public)
values ('training-videos', 'training-videos', false)
on conflict (id) do nothing;

-- Register permissions for system roles + enable the module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'training', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"training": true}'::jsonb where key = 'modules';

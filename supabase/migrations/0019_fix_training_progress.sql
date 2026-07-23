-- The legacy bot's training_progress table (candidate_id/current_chapter)
-- shadowed the app's new table: 0016's "create table if not exists" silently
-- skipped it and progress reporting failed. Same precedent as banks and
-- companies: rename the legacy table, create the intended one.
-- If bot Phase 2 is ever built it must use candidate_training_progress.
alter table training_progress rename to candidate_training_progress;

create table training_progress (
  owner_id uuid not null references owners(id) on delete cascade,
  video_id uuid not null references training_videos(id) on delete cascade,
  seconds_watched integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_id, video_id)
);

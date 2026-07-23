-- Exams module: question bank, exam papers, video unlock links, attempts.

create table if not exists exam_questions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,  -- null = all white labels
  country_id uuid references countries(id) on delete cascade,   -- null = all countries
  type text not null default 'choice' check (type in ('choice','essay')),
  question text not null,
  options jsonb not null default '[]'::jsonb,   -- choice answers ["...", "..."]
  correct_index integer,                        -- choice: index into options
  model_answer text,                            -- essay: reference answer for AI grading
  points integer not null default 1,
  active boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  country_id uuid references countries(id) on delete cascade,
  title text not null,
  description text,
  pass_score integer not null default 70 check (pass_score between 0 and 100),
  retake_wait_minutes integer not null default 0,
  published boolean not null default false,
  sort integer not null default 100,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exam_items (
  exam_id uuid not null references exams(id) on delete cascade,
  question_id uuid not null references exam_questions(id) on delete cascade,
  sort integer not null default 100,
  primary key (exam_id, question_id)
);

-- Videos that must be completed before the exam unlocks
create table if not exists exam_videos (
  exam_id uuid not null references exams(id) on delete cascade,
  video_id uuid not null references training_videos(id) on delete cascade,
  primary key (exam_id, video_id)
);

create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  owner_id uuid not null references owners(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,   -- [{question_id, answer_index?, answer_text?}]
  score numeric,                                -- percent 0-100
  passed boolean,
  feedback jsonb,                               -- {overall, per_question: [{question_id, score, comment}]}
  created_at timestamptz not null default now()
);

create index if not exists exam_attempts_owner_idx
  on exam_attempts(owner_id, exam_id, created_at desc);

-- Permissions + module toggle
insert into role_permissions (role_id, module, action, scope)
select r.id, 'exams', a.action, case when r.level = 'platform' then 'all' else 'merchant' end
from roles r
cross join (values ('view'),('add'),('edit'),('delete')) as a(action)
where r.is_system
on conflict (role_id, module, action) do nothing;

update app_config set value = value || '{"exams": true}'::jsonb where key = 'modules';

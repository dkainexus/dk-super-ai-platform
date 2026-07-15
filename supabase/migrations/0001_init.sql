-- DK Super AI Platform — initial schema
-- Staff / roles
create table staff (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  name text,
  role text not null check (role in ('ceo','coo','director','admin','agent')),
  active boolean not null default true,
  -- Web dashboard login is separate from the Telegram identity above.
  username text unique,
  password_hash text,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Groups / topics
create table groups (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint unique not null,
  title text,
  code text,
  lang text not null default 'th',
  status text not null default 'setup' check (status in ('setup','active','archived')),
  avatar_file_id text,
  general_agent_id uuid references staff(id),
  coo_id uuid references staff(id),
  created_at timestamptz not null default now()
);

create table group_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  topic_key text not null check (topic_key in
    ('general','documentation','notification','company','training','exam','appointment','bank')),
  telegram_thread_id bigint,
  created_at timestamptz not null default now(),
  unique (group_id, topic_key)
);

create table group_bindings (
  group_id uuid primary key references groups(id) on delete cascade,
  agent_staff_id uuid references staff(id),
  owner_candidate_id uuid,
  bound_at timestamptz
);

-- Candidates / documents
create table candidates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id),
  telegram_user_id bigint,
  full_name text,
  id_card_no text,
  phone text,
  status text not null default 'bound' check (status in
    ('bound','docs_submitted','doc_review_pending','doc_approved','doc_rejected',
     'company_registered','training_in_progress','trained','exam_passed',
     'cert_issued','appointment_booked','bank_active')),
  web_profile_id uuid,
  created_at timestamptz not null default now()
);

alter table group_bindings
  add constraint group_bindings_owner_candidate_fk
  foreign key (owner_candidate_id) references candidates(id);

create table document_submissions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  doc_type text not null check (doc_type in ('photo_full_body','id_front','id_back','tabian_baan')),
  file_id text not null,
  uploaded_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_by uuid references staff(id),
  reviewed_at timestamptz,
  reject_reason text
);

-- Company registration
create table companies (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  group_id uuid references groups(id),
  company_name text,
  dbd_status text not null default 'name_confirmed' check (dbd_status in
    ('name_confirmed','submitted_dbd','registered')),
  thai_id_link_sent_at timestamptz,
  dbd_file_id text,
  registered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Training / exam / certificates
create table training_progress (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  current_chapter int not null default 0,
  requested_live_trainer boolean not null default false,
  completed_at timestamptz
);

create table exam_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  stage int,
  score int,
  passed boolean,
  attempted_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  cert_number text unique,
  issued_at timestamptz not null default now(),
  file_url text
);

-- Appointments / banking
create table appointments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  group_id uuid references groups(id),
  scheduled_at timestamptz,
  branch text,
  status text not null default 'proposed' check (status in ('proposed','booked','completed','cancelled')),
  web_status_detail jsonb not null default '{}',
  updated_by_web_at timestamptz
);

create table banks (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  company_id uuid references companies(id),
  bank_name text,
  email text,
  credentials_ref text,
  sim_card_submitted_at timestamptz,
  status text not null default 'pending'
);

create table bank_status_logs (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references banks(id) on delete cascade,
  status text,
  note text,
  source text check (source in ('bot','web')),
  created_at timestamptz not null default now()
);

create table meeting_reports (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete cascade,
  branch text,
  address text,
  screenshots jsonb not null default '[]',
  generated_report_text text,
  generated_at timestamptz not null default now()
);

-- Orchestration: bot registry + job queue
create table bot_registry (
  id uuid primary key default gen_random_uuid(),
  bot_key text unique not null check (bot_key in ('group_ops','onboarding','training','banking','super_ai')),
  display_name text,
  telegram_bot_username text,
  capabilities jsonb not null default '[]',
  status text not null default 'offline',
  last_heartbeat_at timestamptz
);

create table bot_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  target_bot text not null references bot_registry(bot_key),
  scope jsonb not null default '{}',
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in
    ('pending','claimed','running','done','error','cancelled')),
  priority int not null default 100,
  requested_by jsonb,
  result jsonb,
  error text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index bot_jobs_poll_idx on bot_jobs (target_bot, status, run_at);
create index bot_jobs_batch_idx on bot_jobs (((requested_by->>'batch_id')));

-- Carried over from old system
create table topic_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id bigint,
  first_name text,
  text text,
  created_at timestamptz not null default now()
);

create table app_config (
  key text primary key,
  value jsonb not null default '{}'
);

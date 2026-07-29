-- An AI verdict can be overturned by a human who read the transcript. The
-- original verdict is kept so the record shows both.
alter table exam_attempts add column if not exists ai_passed boolean;
alter table exam_attempts add column if not exists overridden_by uuid references users(id) on delete set null;
alter table exam_attempts add column if not exists overridden_at timestamptz;
alter table exam_attempts add column if not exists override_reason text;

-- The AI interview mode: the admin writes the brief the AI examiner follows,
-- and it returns a pass or fail rather than a score.
alter table exams add column if not exists ai_brief text;
alter table exam_attempts add column if not exists transcript jsonb;

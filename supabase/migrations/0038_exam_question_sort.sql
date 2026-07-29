-- Questions in a set are numbered 1, 2, 3… so they need an explicit order.
alter table exam_questions add column if not exists sort integer not null default 100;

-- Give the existing questions their current order.
with ordered as (
  select id, row_number() over (partition by category_id order by created_at) * 10 as n
  from exam_questions
)
update exam_questions q set sort = ordered.n from ordered where ordered.id = q.id;

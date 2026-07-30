-- Preset expense items: common things bought, managed under each category.
-- The expense form suggests them; free typing stays allowed — the expense
-- itself still stores plain item text.
create table expense_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);
alter table expense_items enable row level security;

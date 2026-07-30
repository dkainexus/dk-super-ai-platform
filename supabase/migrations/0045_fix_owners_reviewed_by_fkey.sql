-- owners.reviewed_by pointed at the legacy bot's staff table, so any reviewer
-- who was not in that old table made the approval fail — silently, because the
-- action never checked the error. Point it at users like every other audit column.
update owners set reviewed_by = null
where reviewed_by is not null
  and reviewed_by not in (select id from users);

alter table owners drop constraint if exists owners_reviewed_by_fkey;
alter table owners
  add constraint owners_reviewed_by_fkey
  foreign key (reviewed_by) references users(id) on delete set null;

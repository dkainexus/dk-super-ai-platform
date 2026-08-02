-- Logo (horizontal wordmark) and favicon (square tab icon) are two different
-- pictures — the white label gets a slot for each.
alter table merchants add column if not exists favicon_path text;

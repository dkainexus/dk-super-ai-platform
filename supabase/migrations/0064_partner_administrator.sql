-- The white label's top role reads "Partner Administrator" now — the old
-- name leaked our internal vocabulary into their screens.
update roles set name = 'Partner Administrator' where name = 'White Label Owner' and is_system;

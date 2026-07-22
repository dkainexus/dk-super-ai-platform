-- Owners: full-body photo + personal bank account (bank picked from the Banks module).

alter table owners add column photo_full_body_path text;
alter table owners add column bank_id uuid references banks(id) on delete set null;
alter table owners add column bank_account_no text;

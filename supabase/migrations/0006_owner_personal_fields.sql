-- Owners: gender, marital status, phone, private email.

alter table owners add column gender text check (gender in ('male','female','other'));
alter table owners add column marital_status text check (marital_status in ('single','married','divorced','widowed'));
alter table owners add column phone text;
alter table owners add column email text;

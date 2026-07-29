-- Extra account fields belong to each bank, not to the country.
alter table countries drop column if exists account_fields;

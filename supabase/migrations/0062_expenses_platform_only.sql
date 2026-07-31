-- Expenses are the platform's own money — never a white label's, never a
-- company's — so the tagging columns go. Both were empty.
alter table expenses drop column if exists company_id;
alter table expenses drop column if exists merchant_id;

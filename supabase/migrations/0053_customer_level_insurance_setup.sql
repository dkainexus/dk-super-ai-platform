-- Insurance and the setup fee are customer-level (user's call): one value
-- each on the customer, applying to every account they take. The customer
-- condition rows keep only the pricing; the agent table is untouched.
alter table customers add column if not exists setup_fee numeric not null default 0;
alter table customer_condition_rows drop column if exists setup_fee;
alter table customer_condition_rows drop column if exists deposit;

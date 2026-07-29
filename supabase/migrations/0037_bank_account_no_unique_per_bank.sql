-- The same account number can only be registered once at a given bank, however
-- many times someone submits it.
create unique index if not exists bank_accounts_bank_account_no_uidx
  on bank_accounts (bank_id, account_no);

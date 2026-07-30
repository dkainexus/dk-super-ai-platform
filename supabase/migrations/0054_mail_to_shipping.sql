-- Physical delivery is called shipping, not mail.
alter table account_assignments drop constraint if exists account_assignments_delivery_method_check;
update account_assignments set delivery_method = 'shipping' where delivery_method = 'mail';
alter table account_assignments add constraint account_assignments_delivery_method_check
  check (delivery_method in ('shipping', 'direct'));

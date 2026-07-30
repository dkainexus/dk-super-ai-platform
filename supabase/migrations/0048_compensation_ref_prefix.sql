-- The theft module is called Compensation now — expense claims keep "claim",
-- so the two never share a word. New references read TH-CMP-000001.
drop trigger if exists claims_set_ref on claims;
create trigger claims_set_ref before insert on claims for each row execute function set_ref('claim', 'CMP');

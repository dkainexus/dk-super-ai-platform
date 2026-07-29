-- The language people are spoken to in, per country: the AI examiner opens in it
-- and anything else addressed to trainees can follow.
alter table countries add column if not exists language text not null default 'English';

update countries set language = 'Thai' where code = 'TH';
update countries set language = 'Vietnamese' where code = 'VN';
update countries set language = 'Malay' where code = 'MY';
update countries set language = 'English' where code in ('SG', 'AU');

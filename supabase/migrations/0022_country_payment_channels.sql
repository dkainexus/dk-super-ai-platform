-- Payment channels are defined per country (e.g. PromptPay under Thailand);
-- banks inside that country tick which ones they support.
alter table countries add column if not exists payment_channels jsonb not null default '[]'::jsonb;
update countries set payment_channels = '["PromptPay", "QR Pay"]'::jsonb where code = 'TH' and payment_channels = '[]'::jsonb;

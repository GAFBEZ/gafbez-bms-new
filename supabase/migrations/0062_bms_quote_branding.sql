-- The staff Quote Builder (BMS side of the feature already scaffolded by
-- 0057/0060/0061 for installers) needs its own copy of the free-text
-- boilerplate that appears on a printed quote: a tagline/services line
-- under the GAFBEZ logo, payment details, terms & warranty, and footer
-- details. Name/address/phone/email/logo already exist on app_settings
-- (0019/0020) and are reused as-is -- only the quote-specific text is new
-- here. Same "flexible free text, admin-editable" shape as the
-- installer's customer_profiles.quote_* columns, just on the singleton
-- app_settings row instead of a per-installer profile, since every staff
-- quote uses the one shared GAFBEZ identity.

alter table public.app_settings
  add column quote_tagline text,
  add column quote_services_line text,
  add column quote_payment_details text,
  add column quote_terms_and_warranty text,
  add column quote_footer_details text;

comment on column public.app_settings.quote_tagline is 'Short tagline shown under the GAFBEZ name on printed staff quotes.';
comment on column public.app_settings.quote_services_line is 'One-line services summary shown under the tagline on printed staff quotes.';
comment on column public.app_settings.quote_payment_details is 'Free-text payment/bank details shown on printed staff quotes.';
comment on column public.app_settings.quote_terms_and_warranty is 'Free-text terms & warranty shown on printed staff quotes.';
comment on column public.app_settings.quote_footer_details is 'Free-text extra footer content (address, registration number, etc.) for printed staff quotes.';

-- No RLS/grant changes needed -- app_settings already restricts updates to
-- admins (0012_app_settings.sql) and these are plain columns on the same
-- row, covered by the existing policies automatically.

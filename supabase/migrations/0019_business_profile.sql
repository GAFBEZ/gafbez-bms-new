-- Business profile fields: name, address, phone, email -- previously
-- BUSINESS_NAME was a hardcoded TS constant (src/lib/constants.ts), shown
-- on the login page and the browser tab title with no way to change it
-- without a code deploy. Editable from Settings (admin-only) from here on.

alter table public.app_settings
  add column business_name text not null default 'GAFBEZ Energies Ltd',
  add column business_address text,
  add column business_phone text,
  add column business_email text;

-- Business profile fields are public-facing information -- the same
-- name/address/phone/email a real business already shows on its
-- storefront or website -- unlike default_reorder_level, there's nothing
-- sensitive here, and the login page (pre-authentication) needs to read
-- it so it isn't stuck showing stale/default info after a rebrand. Adds
-- anon read alongside the existing authenticated-only read policy from
-- 0012_app_settings.sql; write stays admin-only (unchanged).
create policy "Anyone can read app settings"
  on public.app_settings
  for select
  to anon
  using (true);

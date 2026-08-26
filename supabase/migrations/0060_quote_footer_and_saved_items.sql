-- Two additions requested after real installer testing of the Quote
-- Builder (0057-0059):
--
-- 1. A free-text "footer details" field -- the printed footer only ever
--    showed phone/email pulled from the account itself, with no way to
--    add a physical address, website, social handles, or registration
--    number. Same "flexible free text, not a rigid set of structured
--    fields" pattern as quote_payment_details/quote_terms_and_warranty.
--
-- 2. quote_saved_items -- lets an installer save a custom line item
--    (name/description/rate) they typed once, so it shows up as a
--    reusable option next time instead of retyping "Cable Pack" or
--    "Installation & Commissioning" on every quote. Deliberately its own
--    table rather than piggybacking on `products`: these are personal to
--    one installer, never shared, and never touch the real catalogue or
--    its pricing/stock machinery.

-- ---------------------------------------------------------------------
-- 1. customer_profiles.quote_footer_details
-- ---------------------------------------------------------------------

alter table public.customer_profiles
  add column quote_footer_details text;

comment on column public.customer_profiles.quote_footer_details is 'Free-text extra footer content for printed quotes (address, website, socials, registration number, etc.) -- shown alongside phone/email, which come from the account fields directly.';

-- update_installer_quote_branding() gains a 7th parameter -- a different
-- argument list is a different function to Postgres, so this is a
-- drop-and-recreate rather than create-or-replace, same technique as
-- create_product()/update_product() in the BMS project when their
-- signatures changed.

drop function if exists public.update_installer_quote_branding(text, text, text, numeric, text, text);

create function public.update_installer_quote_branding(
  p_logo_url text,
  p_tagline text,
  p_services_line text,
  p_markup_percent numeric,
  p_payment_details text,
  p_terms_and_warranty text,
  p_footer_details text
)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_profile public.customer_profiles;
begin
  if v_customer_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_markup_percent is null or p_markup_percent < 0 then
    raise exception 'Markup percent must be zero or greater';
  end if;

  update public.customer_profiles
    set quote_logo_url = nullif(btrim(p_logo_url), ''),
        quote_tagline = nullif(btrim(p_tagline), ''),
        quote_services_line = nullif(btrim(p_services_line), ''),
        quote_markup_percent = p_markup_percent,
        quote_payment_details = nullif(btrim(p_payment_details), ''),
        quote_terms_and_warranty = nullif(btrim(p_terms_and_warranty), ''),
        quote_footer_details = nullif(btrim(p_footer_details), '')
    where id = v_customer_id
    returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text) from public;
revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text) from anon;
grant execute on function public.update_installer_quote_branding(text, text, text, numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. quote_saved_items -- an installer's (or staff member's) own
--    reusable custom line items
-- ---------------------------------------------------------------------

create table public.quote_saved_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null,
  description text,
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.quote_saved_items is 'An owner''s personal library of reusable custom quote line items (e.g. "Cable Pack", "Installation & Commissioning") -- saved once from the Quote Builder''s line-items table, offered back as a pick option on later quotes. Never shared between owners, never touches products/pricing.';

create index quote_saved_items_owner_id_idx on public.quote_saved_items (owner_id);

alter table public.quote_saved_items enable row level security;

create policy "Owners and admins can read saved items"
  on public.quote_saved_items
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "Owners can insert their own saved items"
  on public.quote_saved_items
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can delete their own saved items"
  on public.quote_saved_items
  for delete
  to authenticated
  using (owner_id = auth.uid());

revoke all on public.quote_saved_items from anon;
grant select, insert, delete on public.quote_saved_items to authenticated;

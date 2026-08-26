-- customer_profiles only grants `select` to authenticated (see
-- 0029_customer_accounts_and_cart.sql's own comment: no grant means RLS
-- is never even reached, so a raw UPDATE from a customer's session
-- cannot touch this table at all, full stop). The quote_* branding
-- columns added in 0057_quote_builder.sql need the same SECURITY DEFINER
-- write path as every other customer_profiles field, not a new
-- exception to that rule.
--
-- Left ungated by installer_status on purpose: these six fields only
-- ever become useful once get_installer_catalogue() lets someone
-- through (checked there, not here), so a still-'pending' applicant
-- filling in their logo/terms early is inert, not a privilege escalation
-- -- there is nothing pricing-relevant in this function at all.

create function public.update_installer_quote_branding(
  p_logo_url text,
  p_tagline text,
  p_services_line text,
  p_markup_percent numeric,
  p_payment_details text,
  p_terms_and_warranty text
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
        quote_terms_and_warranty = nullif(btrim(p_terms_and_warranty), '')
    where id = v_customer_id
    returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text) from public;
revoke all on function public.update_installer_quote_branding(text, text, text, numeric, text, text) from anon;
grant execute on function public.update_installer_quote_branding(text, text, text, numeric, text, text) to authenticated;

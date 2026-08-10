-- Installer applicants must show at least 2 of 4 public business-presence
-- links (TikTok, Instagram, Website, Google Business Profile) before they
-- can register as an installer -- lets staff spot-check legitimacy in the
-- BMS review queue before approving wholesale pricing. Same pattern as
-- 0039_installer_accounts.sql's business_name requirement: a friendly
-- client-side check in installerSocialProfilesError() (website repo)
-- backed by a DB-level check constraint here so a bug in the form can
-- never insert a row the database would reject anyway.

-- ---------------------------------------------------------------------
-- 1. New customer_profiles columns
-- ---------------------------------------------------------------------

alter table public.customer_profiles
  add column tiktok_url text,
  add column instagram_url text,
  add column website_url text,
  add column google_profile_url text;

alter table public.customer_profiles
  add constraint customer_profiles_installer_social_profiles_check
  check (
    installer_status = 'none' or (
      (case when nullif(btrim(tiktok_url), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(instagram_url), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(website_url), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(google_profile_url), '') is not null then 1 else 0 end)
    ) >= 2
  );

comment on column public.customer_profiles.tiktok_url is 'Installer signup only -- one of 4 optional business-presence links, at least 2 required (see check constraint). Reviewed by staff in the BMS Installer Applications page, never shown to other customers.';
comment on column public.customer_profiles.instagram_url is 'Installer signup only -- see tiktok_url comment.';
comment on column public.customer_profiles.website_url is 'Installer signup only -- see tiktok_url comment.';
comment on column public.customer_profiles.google_profile_url is 'Installer signup only -- see tiktok_url comment.';

-- ---------------------------------------------------------------------
-- 2. handle_new_customer(): read the four new signup fields
-- ---------------------------------------------------------------------
-- Same trigger, same signature as 0039_installer_accounts.sql -- create
-- or replace, no drop needed. Only change: the four url fields are read
-- from raw_user_meta_data, same null-when-not-an-installer-applicant
-- pattern as business_name.

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_is_installer_applicant boolean;
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    v_is_installer_applicant := coalesce((new.raw_user_meta_data ->> 'is_installer_applicant')::boolean, false);

    insert into public.customer_profiles (
      id, full_name, email, phone, phone_normalized, email_verified,
      is_installer_applicant, business_name, installer_status,
      tiktok_url, instagram_url, website_url, google_profile_url
    )
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer'),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone_normalized'), ''),
      new.email_confirmed_at is not null,
      v_is_installer_applicant,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'business_name'), '') else null end,
      case when v_is_installer_applicant then 'pending' else 'none' end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'tiktok_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'instagram_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'website_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'google_profile_url'), '') else null end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

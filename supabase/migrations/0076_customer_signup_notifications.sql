-- Admin feedback: no notification (bell icon) fires when a new customer
-- registers on the website, or when someone applies as an installer --
-- the only notifications on this flow were already-later events (staff
-- approving/rejecting an application, 0039_installer_accounts.sql), so an
-- admin only ever found out about a new signup/application by happening
-- to visit Customers or Installer Applications and noticing it.
--
-- Both events are really one DB event (an auth.users insert handled by
-- handle_new_customer(), same trigger that already branches on
-- is_installer_applicant to decide what to write into customer_profiles)
-- -- so the fix is adding one notification insert there, same signature,
-- create or replace, no drop needed (last touched by
-- 0040_installer_social_profiles.sql).
--
-- `on conflict (id) do nothing` already guards against a duplicate
-- auth.users trigger firing twice for the same user; `if found then`
-- here makes sure a notification is only created when a profile row was
-- actually inserted, not on a no-op retry.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_is_installer_applicant boolean;
  v_full_name text;
  v_business_name text;
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    v_is_installer_applicant := coalesce((new.raw_user_meta_data ->> 'is_installer_applicant')::boolean, false);
    v_full_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer');
    v_business_name := case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'business_name'), '') else null end;

    insert into public.customer_profiles (
      id, full_name, email, phone, phone_normalized, email_verified,
      is_installer_applicant, business_name, installer_status,
      tiktok_url, instagram_url, website_url, google_profile_url
    )
    values (
      new.id,
      v_full_name,
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone_normalized'), ''),
      new.email_confirmed_at is not null,
      v_is_installer_applicant,
      v_business_name,
      case when v_is_installer_applicant then 'pending' else 'none' end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'tiktok_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'instagram_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'website_url'), '') else null end,
      case when v_is_installer_applicant then nullif(trim(new.raw_user_meta_data ->> 'google_profile_url'), '') else null end
    )
    on conflict (id) do nothing;

    if found then
      if v_is_installer_applicant then
        insert into public.notifications (type, message)
        values ('info', 'New installer application: ' || coalesce(v_business_name, v_full_name) || ' has applied -- review in Installer Applications.');
      else
        insert into public.notifications (type, message)
        values ('info', 'New customer registered: ' || v_full_name || '.');
      end if;
    end if;
  end if;
  return new;
end;
$$;

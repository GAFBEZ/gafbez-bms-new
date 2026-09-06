-- The website's "Installer account approved" banner (InstallerStatusNotice)
-- was showing on every single dashboard visit forever, since it only
-- checked installer_status and there's no reapplication flow to ever
-- move that back to 'pending'/'none'. Adds a one-way "has this installer
-- seen the approval banner yet" flag so it can be shown once and then
-- stay gone, the same way most apps retire a one-time confirmation
-- message. 'pending'/'rejected' notices are unaffected -- those remain
-- actionable/informational on every visit.
alter table public.customer_profiles
  add column installer_approval_seen boolean not null default false;

comment on column public.customer_profiles.installer_approval_seen is 'Set true the first time the customer has been shown the "Installer account approved" banner (status = approved or temp_approved). Never reset -- there is no reapplication flow (see installer_status comment), so an installer only ever needs to see this once.';

-- Same self-service pattern as update_customer_profile_details() /
-- deactivate_customer_account() above: no direct UPDATE grant exists on
-- customer_profiles at all, so this is the only way a customer's own
-- session can flip this column, and it can only ever set it to true for
-- their own row.
create function public.mark_installer_approval_seen()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
begin
  if v_customer_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.customer_profiles
    set installer_approval_seen = true
    where id = v_customer_id and installer_approval_seen = false;
end;
$$;

revoke all on function public.mark_installer_approval_seen() from public;
revoke all on function public.mark_installer_approval_seen() from anon;
grant execute on function public.mark_installer_approval_seen() to authenticated;

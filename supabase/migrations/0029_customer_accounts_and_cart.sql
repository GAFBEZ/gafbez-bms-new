-- Customer accounts (Stage 4 of the public-site rebuild): lets a member of
-- the public register/log in on the GAFBEZ Energies website and manage
-- their own profile, ahead of a branch-pickup cart/checkout flow. This is
-- a **shared-Supabase-project** change, same as 0028_website_catalogue.sql
-- -- the website consumes it with the anon/authenticated key, never
-- service_role.
--
-- IMPORTANT -- this is a completely different concept from public.customers
-- (0005_customers.sql): that table is staff-entered wholesale/walk-in
-- contact + balance records for BMS sales, has no login, and is untouched
-- by this migration. public.customer_profiles below is one row per website
-- login account (auth.users). Deliberately different name so the two are
-- never confused in code or in the dashboard's table list.
--
-- Bigger architectural note, since this is the first time a *public,
-- self-registering* actor is added to this project's auth.users table:
-- auth.users is shared by BOTH staff (BMS) and customers (website) --
-- Supabase Auth has no built-in separation. A website customer's session
-- is, at the Postgres role level, indistinguishable from a staff member's
-- session: both are simply `authenticated`. The only thing that has ever
-- separated "staff" from "everyone else" in this schema is *having a row
-- in public.profiles* (see is_admin() in 0008_role_enforcement.sql, which
-- only ever looks there). Before this migration, 0002_profiles.sql's
-- on_auth_user_created trigger gave EVERY new auth.users row a
-- public.profiles row unconditionally -- which would mean every
-- self-registered customer silently became a "staff" account (role
-- 'staff') the moment they signed up on the public website, purely as a
-- side effect of sharing one auth.users table. That directly conflicts
-- with this stage's "do not grant customers access to staff tables"
-- requirement, so part of this migration (section 2 below) closes that
-- gap by teaching handle_new_user() to skip customer signups. See
-- STAGE_4_CUSTOMER_CART_NOTES.md in the website project for the full
-- writeup, including a separate, pre-existing, NOT fixed here concern:
-- several BMS tables' own RLS policies are `to authenticated using (true)`
-- (no is_admin()/is_staff() check at all -- already flagged as a known
-- limitation in WEBSITE_CATALOGUE_NOTES.md), which after this migration
-- means a self-registered customer's `authenticated` session could in
-- principle reach them too. Fixing that is a larger, cross-cutting
-- rewrite of several other migrations' policies and is deliberately left
-- as flagged, recommended follow-up work rather than done silently here.

-- ---------------------------------------------------------------------
-- 1. customer_profiles
-- ---------------------------------------------------------------------
-- One row per website customer account. No password is ever stored here
-- (Supabase Auth owns auth.users.encrypted_password entirely) --
-- customer_profiles only ever holds the public-facing/contact fields the
-- task brief asked for.

create table public.customer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (btrim(full_name) <> ''),
  email text not null unique,
  phone text,
  phone_normalized text unique,
  email_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_profiles is 'One row per website customer login (auth.users). Not the same table as public.customers (BMS staff-entered sales contacts, 0005_customers.sql) -- see this migration''s header comment.';
comment on column public.customer_profiles.phone_normalized is 'Nigerian phone number normalised to +234XXXXXXXXXX by the website app (src/lib/customer/phone.ts) before every write. Unique when provided -- Postgres unique constraints already allow unlimited NULLs.';
comment on column public.customer_profiles.email_verified is 'Mirrors auth.users.email_confirmed_at via sync_customer_profile_from_auth() below. Never set directly by application code -- this column can never disagree with Supabase Auth''s own verification state.';

alter table public.customer_profiles enable row level security;

create policy "Customers can read their own profile"
  on public.customer_profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can read customer profiles"
  on public.customer_profiles
  for select
  to authenticated
  using (public.is_admin());

-- Deliberately no INSERT/UPDATE/DELETE policy for authenticated/anon at
-- all: rows are only ever created by handle_new_customer() below and only
-- ever modified by update_customer_profile_details()/
-- deactivate_customer_account()/sync_customer_profile_from_auth(), all
-- SECURITY DEFINER. This is stricter than an RLS `using (auth.uid() = id)`
-- update policy would be -- a raw UPDATE statement from a customer's own
-- session cannot reach this table at all (no GRANT, so RLS is never even
-- reached), which is what makes "customers must not edit verification
-- status/role/etc." a database-enforced fact rather than a UI convention.
-- Anon has no policy and no grant at all -- anonymous users cannot read or
-- write any row, full stop.

grant select on public.customer_profiles to authenticated;

create trigger set_customer_profiles_updated_at
  before update on public.customer_profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Auto-create a customer profile on signup (and stop staff profiles
--    from being created for customer signups)
-- ---------------------------------------------------------------------
-- The website's registration Server Action calls supabase.auth.signUp()
-- with user_metadata.account_type = 'customer' -- that's the only signal
-- distinguishing a customer signup from a staff account (still created via
-- the Supabase Dashboard "Add user", which sets no such metadata, per
-- 0002_profiles.sql's own comment).

create function public.handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    insert into public.customer_profiles (id, full_name, email, phone, phone_normalized, email_verified)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer'),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone_normalized'), ''),
      new.email_confirmed_at is not null
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_customer_created
  after insert on auth.users
  for each row execute procedure public.handle_new_customer();

-- Replaces (create or replace, same function name/signature -- the
-- existing trigger in 0002_profiles.sql keeps pointing at it, so that file
-- itself is untouched) handle_new_user() with a version that skips
-- customer signups, so a website customer never gets a public.profiles
-- row -- see this migration's header comment for why that matters.
-- Behaviour for staff (dashboard-created, no account_type metadata) is
-- byte-for-byte unchanged from the original.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    return new;
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Keep customer_profiles in sync with Supabase Auth's own state
-- ---------------------------------------------------------------------
-- Fires on every auth.users update (staff and customers); no-ops
-- immediately for staff (no matching customer_profiles row). For
-- customers, mirrors email_confirmed_at -> email_verified and a
-- confirmed email change (auth.users.email only changes once Supabase has
-- verified the new address) down onto customer_profiles.email, and logs
-- the email change to the audit table. Application code never sets
-- email_verified directly -- this trigger is the only writer.

create function public.sync_customer_profile_from_auth()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_previous_email text;
  v_previous_verified boolean;
begin
  select email, email_verified into v_previous_email, v_previous_verified
    from public.customer_profiles where id = new.id;

  if not found then
    return new;
  end if;

  if v_previous_email is distinct from new.email then
    insert into public.customer_profile_audit (customer_id, event_type, old_value, new_value)
    values (new.id, 'email_change_confirmed', v_previous_email, new.email);
  end if;

  if v_previous_verified is distinct from (new.email_confirmed_at is not null)
    or v_previous_email is distinct from new.email
  then
    update public.customer_profiles
      set email_verified = (new.email_confirmed_at is not null),
          email = new.email
      where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_updated_sync_customer_profile
  after update on auth.users
  for each row execute procedure public.sync_customer_profile_from_auth();

-- ---------------------------------------------------------------------
-- 4. customer_profile_audit
-- ---------------------------------------------------------------------
-- One row per major profile change, per the task brief's "email change,
-- phone change, account deactivation" list. Only ever written by the
-- SECURITY DEFINER functions/trigger above -- there is no INSERT policy
-- for authenticated/anon, so this table cannot be forged or edited by any
-- client, only appended to by the server-side functions that also perform
-- the underlying change.

create table public.customer_profile_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  event_type text not null check (event_type in ('email_change_confirmed', 'phone_change', 'account_deactivated')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

comment on table public.customer_profile_audit is 'Append-only log of major customer_profiles changes. Written only by SECURITY DEFINER functions (update_customer_profile_details, deactivate_customer_account, sync_customer_profile_from_auth) -- no client, staff or customer, can insert/update/delete a row directly.';

alter table public.customer_profile_audit enable row level security;

create policy "Customers can read their own audit history"
  on public.customer_profile_audit
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read customer audit history"
  on public.customer_profile_audit
  for select
  to authenticated
  using (public.is_admin());

grant select on public.customer_profile_audit to authenticated;

-- ---------------------------------------------------------------------
-- 5. Safe phone-availability check (pre-flight for registration/profile
--    forms, before a unique-constraint round trip)
-- ---------------------------------------------------------------------
-- Returns only a boolean -- never the profile that phone belongs to --
-- so this cannot be used to enumerate or read any customer's data,
-- unlike a hypothetical "does this profile exist" query against the table
-- itself (which anon has no grant on anyway).

create function public.check_customer_phone_available(p_phone_normalized text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.customer_profiles where phone_normalized = p_phone_normalized
  );
$$;

revoke all on function public.check_customer_phone_available(text) from public;
grant execute on function public.check_customer_phone_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. The only write path for a customer's own profile
-- ---------------------------------------------------------------------
-- Always operates on auth.uid() -- never accepts or trusts a caller-
-- supplied customer id -- so there is no code path where one customer's
-- session could edit another's row even if the application layer had a
-- bug. Full name + phone only, matching exactly what customers are
-- allowed to change directly (email goes through Supabase Auth's own
-- email-change flow instead, see STAGE_4_CUSTOMER_CART_NOTES.md).

create function public.update_customer_profile_details(
  p_full_name text,
  p_phone text,
  p_phone_normalized text
)
returns public.customer_profiles
language plpgsql
security definer set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_previous_phone_normalized text;
  v_profile public.customer_profiles;
begin
  if v_customer_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(p_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  select phone_normalized into v_previous_phone_normalized
    from public.customer_profiles where id = v_customer_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  begin
    update public.customer_profiles
      set full_name = btrim(p_full_name),
          phone = nullif(btrim(p_phone), ''),
          phone_normalized = nullif(btrim(p_phone_normalized), '')
      where id = v_customer_id
      returning * into v_profile;
  exception when unique_violation then
    raise exception 'That phone number is already registered to another account';
  end;

  if v_profile.phone_normalized is distinct from v_previous_phone_normalized then
    insert into public.customer_profile_audit (customer_id, event_type, old_value, new_value)
    values (v_customer_id, 'phone_change', v_previous_phone_normalized, v_profile.phone_normalized);
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_customer_profile_details(text, text, text) from public;
revoke all on function public.update_customer_profile_details(text, text, text) from anon;
grant execute on function public.update_customer_profile_details(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Self-service deactivation
-- ---------------------------------------------------------------------
-- Same auth.uid()-only pattern as above. Does not delete the row (order
-- history in a later stage will need to survive) or touch auth.users --
-- the website signs the customer out client-side immediately after
-- calling this.

create function public.deactivate_customer_account()
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
    set is_active = false
    where id = v_customer_id and is_active = true;

  if found then
    insert into public.customer_profile_audit (customer_id, event_type, old_value, new_value)
    values (v_customer_id, 'account_deactivated', 'active', 'inactive');
  end if;
end;
$$;

revoke all on function public.deactivate_customer_account() from public;
revoke all on function public.deactivate_customer_account() from anon;
grant execute on function public.deactivate_customer_account() to authenticated;

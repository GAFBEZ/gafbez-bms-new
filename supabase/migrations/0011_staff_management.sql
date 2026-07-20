-- Staff Management (lightweight). Account creation still happens in the
-- Supabase Dashboard (Authentication -> Add user) since that requires the
-- service_role secret key, which this app deliberately never handles -- a
-- leaked service_role key bypasses RLS entirely. Everything after account
-- creation (name, role, branch assignment, activation) is managed here.

alter table public.profiles add column email text;
alter table public.profiles add column is_active boolean not null default true;

-- Backfill email for profiles created before this column existed. Safe to
-- run in the SQL Editor (which executes as the table owner, not through
-- RLS) -- the app itself never gets to read auth.users directly.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep email in sync for staff created from here on.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

-- The existing "Users can read/update their own profile" policies only let
-- someone see or touch their own row. Admins additionally need to see and
-- edit everyone's.
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update any profile"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The "own profile" update policy has no WITH CHECK, so Postgres reuses its
-- USING clause (auth.uid() = id) for both -- meaning a staff member could
-- otherwise UPDATE their own role/branch_id/is_active via a direct API
-- call, with no admin approval. This trigger closes that gap for every
-- update path (both the "own profile" and "admin" policies), regardless of
-- which one matched.
create function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.branch_id is distinct from old.branch_id
      or new.is_active is distinct from old.is_active)
     and not public.is_admin() then
    raise exception 'Only admins can change role, branch, or active status';
  end if;
  return new;
end;
$$;

create trigger prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_escalation();

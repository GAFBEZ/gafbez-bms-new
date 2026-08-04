-- Fixes genuine infinite recursion in is_admin()/is_staff(). Both were
-- created as plain SQL functions (SECURITY INVOKER, the default), so their
-- own internal `select ... from public.profiles` lookup is itself subject
-- to profiles' RLS -- which includes "Admins can read all profiles"
-- (0011_staff_management.sql), gated by is_admin(). Every call to
-- is_admin()/is_staff() therefore re-triggers profiles' RLS, which
-- re-evaluates is_admin() again, and so on. Confirmed via Supabase's
-- Postgres logs: a "stack depth limit exceeded" error with a CONTEXT
-- trace of hundreds of nested "SQL function is_admin" frames bottoming
-- out from is_staff().
--
-- Marking both SECURITY DEFINER makes their internal profiles lookup run
-- as the function owner (which bypasses RLS for that one lookup only),
-- breaking the cycle. This doesn't loosen any actual access control --
-- both functions already only ever look up the CALLER's own row
-- (`where id = auth.uid()`), so bypassing RLS here just skips a
-- self-referential check that was always going to resolve to "yes, you
-- can see your own row" anyway.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

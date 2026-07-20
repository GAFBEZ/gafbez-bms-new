-- Staff attribution: Stock Movement, Daily Sales, and Expenses have all
-- captured `created_by` since they launched, but nothing ever read it back
-- -- no list shows who actually recorded a given row, even though a
-- multi-branch team has an obvious reason to want that ("who logged this
-- stock adjustment", "who recorded this sale").
--
-- The blocker: `profiles` RLS only lets a user read their own row, or
-- every row if they're an admin (see 0002_profiles.sql/0011_staff_management.sql)
-- -- a non-admin embedding `profiles(full_name)` into these lists would see
-- their own name and blanks for everyone else's. Loosening `profiles`'
-- SELECT policy outright would also expose email/role/branch, which
-- Staff Management deliberately restricts. Instead, a narrow
-- SECURITY DEFINER function returns only `id` + `full_name` for every
-- profile -- nothing sensitive, available to any signed-in staff member,
-- consistent with names already being visible team-wide in things like
-- the Customers list.

create function public.get_staff_names()
returns table (id uuid, full_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select id, full_name from public.profiles;
$$;

revoke all on function public.get_staff_names() from public;
revoke all on function public.get_staff_names() from anon;
grant execute on function public.get_staff_names() to authenticated;

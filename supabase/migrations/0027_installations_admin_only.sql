-- Installation is now an admin-only feature (like Inventory Master and
-- Staff Management), not just an operational record open to all staff
-- (like Expenses). Tighten read/write to admins at the RLS level, not
-- just by hiding the nav link -- a non-admin's own valid session could
-- otherwise still read/write this table directly. Delete was already
-- admin-only (0025_installations.sql); this replaces the open
-- select/insert/update policies with the same public.is_admin() check.

drop policy "Authenticated users can read installations" on public.installations;
create policy "Only admins can read installations"
  on public.installations for select to authenticated using (public.is_admin());

drop policy "Authenticated users can insert installations" on public.installations;
create policy "Only admins can insert installations"
  on public.installations for insert to authenticated with check (public.is_admin());

drop policy "Authenticated users can update installations" on public.installations;
create policy "Only admins can update installations"
  on public.installations for update to authenticated using (public.is_admin());

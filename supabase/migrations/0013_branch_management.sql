-- Branch Management. Lets admins add branches and rename/activate
-- existing ones from Settings, instead of only via SQL migration.
--
-- Also tightens the original `0001_branches.sql` policy, which granted
-- SELECT to `anon` -- a leftover from before staff auth existed (its own
-- comment said "will be tightened once staff accounts and roles exist",
-- which never actually happened). Nothing in the app relies on
-- unauthenticated branch reads (the selector only renders inside the
-- authenticated dashboard), so this is a safe hardening, not a behavior
-- change for real usage.
drop policy "Branches are readable by anyone" on public.branches;

create policy "Authenticated users can read branches"
  on public.branches
  for select
  to authenticated
  using (true);

create policy "Only admins can add branches"
  on public.branches
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Only admins can update branches"
  on public.branches
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deliberately no DELETE policy -- branches are referenced by branch_id
-- across stock_movements, sales, customers, expenses, documents, and
-- profiles. Deactivating (status = 'coming_soon') is the supported way to
-- retire one; deleting isn't offered anywhere in the app.

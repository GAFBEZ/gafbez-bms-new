-- Expenses' insert/update RLS policies were `with check (public.is_staff())`/
-- `using (public.is_staff())` since 0033 -- is_staff() only verifies "this
-- is a BMS staff account" (as opposed to a website customer), with no
-- branch check at all, so any staff member could create or edit an
-- expense at any branch, unlike record_sale/record_stock_movement/
-- record_return, which are locked to a non-admin's assigned branch
-- (0023/0069). Tightens both to the same rule: admin, an unassigned-
-- branch staff member, or a caller whose branch matches the expense's
-- branch. The app-level check in
-- src/app/dashboard/expenses/actions.ts backs this up with a clear
-- error message; this is the enforcement that holds even if that
-- action is ever bypassed.
drop policy "Staff can insert expenses" on public.expenses;
create policy "Staff can insert expenses at their own branch"
  on public.expenses
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (select branch_id from public.profiles where id = auth.uid()) is null
    or (select branch_id from public.profiles where id = auth.uid()) = branch_id
  );

drop policy "Staff can update expenses" on public.expenses;
create policy "Staff can update expenses at their own branch"
  on public.expenses
  for update
  to authenticated
  using (
    public.is_admin()
    or (select branch_id from public.profiles where id = auth.uid()) is null
    or (select branch_id from public.profiles where id = auth.uid()) = branch_id
  )
  with check (
    public.is_admin()
    or (select branch_id from public.profiles where id = auth.uid()) is null
    or (select branch_id from public.profiles where id = auth.uid()) = branch_id
  );

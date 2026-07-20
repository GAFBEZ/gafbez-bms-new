-- First cut at role enforcement. Scope is deliberately narrow: only DELETE
-- (irreversible, highest-risk) is restricted to admins. CREATE/UPDATE and
-- day-to-day operational actions (recording sales, stock movements) stay
-- open to all authenticated staff -- that's normal operational work, not
-- something that needs gatekeeping.
--
-- is_admin() is a plain SECURITY INVOKER function (no elevated privilege
-- needed): it only reads the CALLING user's own profiles row, which the
-- existing "Users can read their own profile" policy already allows.
-- Contrast with record_stock_movement()/record_sale(), which genuinely
-- need SECURITY DEFINER because they write across tables the caller has
-- no direct write access to.
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy "Authenticated users can delete products" on public.products;
create policy "Only admins can delete products"
  on public.products
  for delete
  to authenticated
  using (public.is_admin());

drop policy "Authenticated users can delete customers" on public.customers;
create policy "Only admins can delete customers"
  on public.customers
  for delete
  to authenticated
  using (public.is_admin());

drop policy "Authenticated users can delete expenses" on public.expenses;
create policy "Only admins can delete expenses"
  on public.expenses
  for delete
  to authenticated
  using (public.is_admin());

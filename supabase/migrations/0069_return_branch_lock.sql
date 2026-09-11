-- record_sale() and record_stock_movement() were branch-locked for
-- non-admins in 0023_branch_locked_staff.sql, but record_return() was
-- never given the same treatment -- any authenticated staff account
-- could process a return on any sale in the system, regardless of which
-- branch it belongs to or which branch they're assigned to. Closes that
-- gap with the identical check, keyed off the original sale's branch
-- (already looked up here as v_sale.branch_id) rather than a request
-- parameter, since record_return doesn't take a branch id at all.
--
-- Same technique as 0022/0023: CREATE OR REPLACE with an unchanged
-- signature, so the existing anon-revoke/authenticated-grant carries
-- over with no drop needed.
create or replace function public.record_return(
  p_sale_item_id uuid,
  p_quantity integer,
  p_reason text
)
returns public.sale_returns
language plpgsql
security definer set search_path = ''
as $$
declare
  v_sale_item public.sale_items;
  v_sale public.sales;
  v_already_returned integer;
  v_return public.sale_returns;
  v_return_value numeric;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
begin
  if p_quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;

  select * into v_sale_item from public.sale_items where id = p_sale_item_id;
  if not found then
    raise exception 'Sale item not found';
  end if;

  select * into v_sale from public.sales where id = v_sale_item.sale_id;

  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_sale.branch_id
  then
    raise exception 'You can only process returns for sales at your assigned branch';
  end if;

  select coalesce(sum(quantity), 0) into v_already_returned
    from public.sale_returns
    where sale_item_id = p_sale_item_id;

  if v_already_returned + p_quantity > v_sale_item.quantity then
    raise exception 'Cannot return more than was sold (already returned %, sold %)',
      v_already_returned, v_sale_item.quantity;
  end if;

  insert into public.sale_returns (sale_item_id, quantity, reason, created_by)
  values (p_sale_item_id, p_quantity, nullif(p_reason, ''), auth.uid())
  returning * into v_return;

  insert into public.product_stock (product_id, branch_id, quantity)
  values (v_sale_item.product_id, v_sale.branch_id, p_quantity)
  on conflict (product_id, branch_id) do update
    set quantity = public.product_stock.quantity + excluded.quantity;

  insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
  values (
    v_sale_item.product_id,
    v_sale.branch_id,
    'in',
    p_quantity,
    'Return: Sale ' || v_sale.id,
    auth.uid()
  );

  v_return_value := p_quantity * v_sale_item.unit_price;

  if v_sale.customer_id is not null then
    update public.customers
      set outstanding_balance = greatest(0, outstanding_balance - v_return_value)
      where id = v_sale.customer_id;
  end if;

  return v_return;
end;
$$;

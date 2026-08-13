-- sales.customer_id references public.customers, the in-branch walk-in
-- table (0006_sales.sql) -- an entirely different identity space from a
-- website order's customer_profiles/auth.users record. When
-- mark_whatsapp_order_paid (0054) creates a sales row for a WhatsApp
-- order, there's no customers row to link, so customer_id was left null
-- and the Daily Sales page fell back to its generic "Walk-in customer"
-- label -- losing the real customer's name entirely, even though the
-- order itself has it.
--
-- Adds a free-text override column instead of trying to force a link
-- into the customers table (that table means "a customer with a running
-- account/outstanding-balance at this branch", which a one-off WhatsApp
-- buyer generally isn't). Read paths prefer this over the customers(name)
-- join; a manually-recorded sale (record_sale, still customer_id-only)
-- is unaffected since this column is simply null there.

alter table public.sales add column customer_name text;

comment on column public.sales.customer_name is 'Display-only override for a sale with no linked public.customers row, e.g. one created from a WhatsApp order (see mark_whatsapp_order_paid) -- carries the customer''s name from the order itself since there''s no walk-in customer record to join to. Null for a sale recorded the normal way through record_sale(), which still relies on the customer_id join.';

create or replace function public.mark_whatsapp_order_paid(p_order_id uuid)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
  v_branch_name text;
  v_reservation record;
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_product_name text;
  v_sale public.sales;
begin
  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if v_caller_is_admin is null then
    raise exception 'Only staff can mark orders as paid';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_order.branch_id
  then
    raise exception 'You can only update orders at your assigned branch';
  end if;

  if v_order.order_type <> 'whatsapp_request' then
    raise exception 'This action is only for WhatsApp orders';
  end if;

  if v_order.status <> 'whatsapp_confirmed' then
    raise exception 'This order must be confirmed before it can be marked as paid';
  end if;

  if not exists (select 1 from public.stock_reservations where order_id = v_order.id and status = 'active') then
    raise exception 'This order''s reservation already expired -- cancel it and ask the customer to re-order';
  end if;

  select name into v_branch_name from public.branches where id = v_order.branch_id;

  for v_reservation in
    select * from public.stock_reservations where order_id = v_order.id and status = 'active' order by product_id
  loop
    select reorder_level, name into v_reorder_level, v_product_name
      from public.products where id = v_reservation.product_id;

    select quantity into v_previous_quantity
      from public.product_stock
      where product_id = v_reservation.product_id and branch_id = v_reservation.branch_id
      for update;
    v_previous_quantity := coalesce(v_previous_quantity, 0);

    if v_previous_quantity < v_reservation.quantity then
      raise exception 'Insufficient physical stock to fulfil this order';
    end if;

    update public.product_stock
      set quantity = quantity - v_reservation.quantity
      where product_id = v_reservation.product_id and branch_id = v_reservation.branch_id
      returning quantity into v_new_quantity;

    update public.stock_reservations
      set status = 'fulfilled', fulfilled_at = now()
      where id = v_reservation.id;

    insert into public.stock_movements (product_id, branch_id, type, quantity, reason, created_by)
    values (v_reservation.product_id, v_reservation.branch_id, 'out', v_reservation.quantity,
            'WhatsApp order ' || v_order.order_number, auth.uid());

    if v_new_quantity <= coalesce(v_reorder_level, 0) and v_previous_quantity > coalesce(v_reorder_level, 0) then
      insert into public.notifications (type, message)
      values (
        'warning',
        v_product_name || ' is running low on stock at ' || coalesce(v_branch_name, v_order.branch_id)
          || ' (' || v_new_quantity || ' left, reorder level ' || v_reorder_level || ').'
      );
    end if;
  end loop;

  insert into public.sales (customer_id, customer_name, branch_id, total_amount, amount_paid, status, created_by)
  values (null, v_order.customer_name, v_order.branch_id, v_order.amount_payable, v_order.amount_payable, 'paid', auth.uid())
  returning * into v_sale;

  insert into public.sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
  select v_sale.id, oi.product_id, oi.quantity, oi.website_price,
         coalesce((select cost_price from public.products where id = oi.product_id), 0)
  from public.order_items oi
  where oi.order_id = v_order.id;

  update public.orders
    set payment_status = 'successful',
        status = 'completed',
        amount_paid = v_order.amount_payable,
        paid_at = now()
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('success', 'WhatsApp order ' || v_order.order_number || ' marked as paid and completed.');

  return v_order;
end;
$$;

revoke all on function public.mark_whatsapp_order_paid(uuid) from public;
revoke all on function public.mark_whatsapp_order_paid(uuid) from anon;
grant execute on function public.mark_whatsapp_order_paid(uuid) to authenticated;

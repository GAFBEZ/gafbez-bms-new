-- Two gaps found while checking why Today's Sales showed 0 despite paid
-- WhatsApp orders existing:
--
-- 1. mark_whatsapp_order_paid (0049) never actually fulfilled the stock
--    reservation -- it only flipped the order's own status/payment
--    columns. product_stock was never decremented, and the reservation
--    was left 'active' instead of 'fulfilled'. Once the reservation's
--    expires_at passed, get_available_to_sell (0030) would start
--    counting that stock as available again even though it had actually
--    left the branch -- a real overselling risk, not just a cosmetic
--    gap. Fixed by mirroring finalize_successful_online_order's per-item
--    fulfil loop exactly (deduct product_stock, mark the reservation
--    'fulfilled', log a stock_movements row, raise a low-stock
--    notification if crossed).
--
-- 2. Daily Sales (public.sales, see 0006/0018/0023_*.sql) is only ever
--    written by record_sale(), called from the manual "New Sale" form --
--    nothing writes there for a website/WhatsApp order, online or not.
--    So the dashboard's Today's Sales and Net Profit cards
--    (getLiveTodaySales/getLiveNetProfit, src/lib/dashboard.ts) never
--    reflect WhatsApp revenue at all. Fixed by inserting a matching
--    sales + sale_items row here -- customer_id is left null (sales.
--    customer_id references public.customers, the in-branch walk-in
--    table, an entirely different identity space from the website's
--    customer_profiles/auth.users -- same as how a walk-in POS sale with
--    no linked customer record already looks). No separate stock
--    deduction on this insert (record_sale normally does its own) since
--    fulfilling the reservation above already accounts for it -- doing
--    both would double-deduct.
--
-- Deliberately scoped to WhatsApp orders only, per the business's current
-- decision to not use Paystack -- finalize_successful_online_order (the
-- Paystack equivalent) is untouched.

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

  insert into public.sales (customer_id, branch_id, total_amount, amount_paid, status, created_by)
  values (null, v_order.branch_id, v_order.amount_payable, v_order.amount_payable, 'paid', auth.uid())
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

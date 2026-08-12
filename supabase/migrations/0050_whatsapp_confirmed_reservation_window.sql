-- confirm_whatsapp_order() (0030_orders_and_payments.sql) reused
-- app_settings.reservation_expiry_minutes -- the 30-minute window meant
-- for "customer is mid-checkout on the website, paying by card right
-- now" -- as the reservation window for a *confirmed* WhatsApp order too.
-- But a WhatsApp order is confirmed once staff and the customer have
-- agreed the customer will come pay/pick up in person, which is normally
-- hours or days later, not minutes. release_expired_reservations()
-- (also 0030) was therefore silently flipping freshly-confirmed WhatsApp
-- orders to 'expired' and releasing their stock before the customer ever
-- got a chance to show up -- reported by the business after a confirmed,
-- unpaid order it hadn't touched turned into "expired" on its own.
--
-- Fix: give whatsapp_confirmed orders their own, much longer window via
-- a separate app_settings column, so the two flows can be tuned
-- independently. release_expired_reservations() itself needs no change --
-- it already just compares orders.reservation_expires_at to now(),
-- whatever produced that timestamp.

alter table public.app_settings
  add column whatsapp_reservation_hours integer not null default 72
    check (whatsapp_reservation_hours > 0);

comment on column public.app_settings.whatsapp_reservation_hours is 'How long stock stays reserved for a confirmed WhatsApp order awaiting in-person payment/pickup before release_expired_reservations() releases it and expires the order. Default 72 hours (3 days) -- deliberately much longer than reservation_expiry_minutes, which is for the website''s own card-payment checkout.';

create or replace function public.confirm_whatsapp_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
  v_item record;
  v_available integer;
  v_expiry_hours integer;
  v_expires_at timestamptz;
begin
  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if v_caller_is_admin is null then
    raise exception 'Only staff can confirm WhatsApp requests';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_order.branch_id
  then
    raise exception 'You can only confirm requests at your assigned branch';
  end if;

  if v_order.status <> 'whatsapp_review_required' then
    raise exception 'This request is not awaiting confirmation';
  end if;

  select whatsapp_reservation_hours into v_expiry_hours from public.app_settings;
  v_expires_at := now() + make_interval(hours => coalesce(v_expiry_hours, 72));

  -- Re-validate and reserve, item by item, locking each product's branch
  -- stock row exactly like create_online_order_with_reservation does.
  for v_item in
    select oi.id as order_item_id, oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id
    order by oi.product_id
  loop
    perform quantity from public.product_stock
      where product_id = v_item.product_id and branch_id = v_order.branch_id
      for update;

    v_available := public.get_available_to_sell(v_item.product_id, v_order.branch_id);
    if v_available < v_item.quantity then
      raise exception 'Insufficient stock to confirm this request';
    end if;

    insert into public.stock_reservations (order_id, order_item_id, product_id, branch_id, quantity, status, expires_at)
    values (v_order.id, v_item.order_item_id, v_item.product_id, v_order.branch_id, v_item.quantity, 'active', v_expires_at);
  end loop;

  update public.orders
    set status = 'whatsapp_confirmed', reservation_expires_at = v_expires_at
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('success', 'WhatsApp request ' || v_order.order_number || ' confirmed and stock reserved.');

  return v_order;
end;
$$;

revoke all on function public.confirm_whatsapp_order(uuid) from public;
revoke all on function public.confirm_whatsapp_order(uuid) from anon;
grant execute on function public.confirm_whatsapp_order(uuid) to authenticated;

-- Staff-side cancel for a *confirmed* WhatsApp order (as opposed to
-- reject_whatsapp_order, which only works pre-confirmation --
-- 0030_orders_and_payments.sql). Once confirmed, the only way to release
-- the reservation used to be waiting out the reservation window (5 hours
-- as of 0052_whatsapp_reservation_5_hours.sql) -- if staff confirmed by
-- mistake, or the customer backs out before paying, that stock sat
-- locked for no reason. This lets staff release it immediately instead.
--
-- Mirrors cancel_own_order's stock-release step exactly (release active
-- reservations, then set the order to 'cancelled') -- same terminal
-- status reject_whatsapp_order already uses, so this shows up identically
-- in the UI (STATUS_LABELS.cancelled = "rejected") and is eligible for
-- delete_whatsapp_order (0051) same as any other rejected order.

create function public.cancel_confirmed_whatsapp_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_caller_branch_id text;
begin
  select role = 'admin', branch_id into v_caller_is_admin, v_caller_branch_id
    from public.profiles where id = auth.uid();

  if v_caller_is_admin is null then
    raise exception 'Only staff can cancel WhatsApp requests';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not coalesce(v_caller_is_admin, false)
    and v_caller_branch_id is not null
    and v_caller_branch_id <> v_order.branch_id
  then
    raise exception 'You can only cancel requests at your assigned branch';
  end if;

  if v_order.status <> 'whatsapp_confirmed' then
    raise exception 'Only a confirmed, unpaid request can be cancelled here';
  end if;

  update public.stock_reservations
    set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';

  update public.orders
    set status = 'cancelled', cancelled_at = now(),
        cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled by staff before payment')
    where id = v_order.id
    returning * into v_order;

  insert into public.notifications (type, message)
  values ('warning', 'WhatsApp request ' || v_order.order_number || ' was cancelled and its reserved stock released.');

  return v_order;
end;
$$;

revoke all on function public.cancel_confirmed_whatsapp_order(uuid, text) from public;
revoke all on function public.cancel_confirmed_whatsapp_order(uuid, text) from anon;
grant execute on function public.cancel_confirmed_whatsapp_order(uuid, text) to authenticated;

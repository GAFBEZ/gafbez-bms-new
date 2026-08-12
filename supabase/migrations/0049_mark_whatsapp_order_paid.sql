-- The WhatsApp Orders page only ever surfaced the awaiting-review queue,
-- and confirming an order (whatsapp_confirmed) was a dead end -- no
-- function existed to record that the customer actually paid once they
-- came in. This adds the missing step: confirmed -> paid, closing the
-- loop the same way finalize_successful_online_order does for Paystack
-- orders, just triggered by staff instead of a webhook. Payment and
-- pickup happen together for a WhatsApp/branch-pickup order, so this
-- also moves status straight to 'completed' rather than introducing a
-- separate pickup step.

create function public.mark_whatsapp_order_paid(p_order_id uuid)
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
